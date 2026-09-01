"""
Cerveau IA de Hmied.

Utilise en priorite OpenRouter (une seule cle API -> tous les modeles,
dont des modeles GRATUITS) sinon Ollama local.
"""

import os
import re

import requests

import config

_OLLAMA = "http://127.0.0.1:11434"
_MODELE_OLLAMA = None  # choisi automatiquement parmi les modeles installes
_MODELE_OLLAMA_PRIORITES = [
    "qwen2.5:3b",
    "gemma2:2b",
    "llama3.2:3b",
    "qwen2.5:1.5b",
]

_EN_LIGNE = False
_SOURCE = None  # None | "openrouter" | "ollama"

_SYSTEM = (
    "Tu es Hmied (حميد), assistant personnel. Ton nom TUNAISIEN est Hmied, qui s'ecrit ET se prononce « حميد » "
    "(lettres ح، م، ي، د). "
    "ATTENTION : ne t'appelle jamais « Hamid », « Hamed », « حامد » ni « أحمد » — ton nom est TOUJOURS « حميد » (Hmied). "
    "Quand on demande ton nom, reponds « أنا حميد » (Hmied).\n"
    "Tu assistes Hamdi (حمدي) qui vit en Tunisie. Ton proprietaire s'appelle Hamdi (حمدي), PAS Ahmed, JAMAIS Ahmed. "
    "Quand on te demande qui est ton maitre ou ton proprietaire, reponds toujours « حمدي » (Hamdi).\n"
    "REGLE ABSOLUE : tu DOIS TOUJOURS parler en DERJA TUNISIENNE (arabe tunisien \"Tounsi\" parlé du quotidien). "
    "JAMAIS en arabe littéraire (fusha), JAMAIS en français pur. "
    "ECRITURE OBLIGATOIRE : écris TOUJOURS la derja en LETTRES ARABES (ex: صحة، بش خير، واش نعاونك)\n"
    "  - N'écris PAS en lettres latines (pas: \"saha yekhi behi\").\n"
    "  - N'utilise JAMAIS les chiffres substituts des lettres arabes : interdits -> 3 (ع), 7 (ح), 9 (ق), "
    "5 (خ), 2 (أ), ' (ع), 8 (غ). Utilise la vraie lettre arabe à la place (ع، ح، ق، خ، غ...).\n"
    "  - Exemples corrects : «شنو وقع؟» (pas \"chnouwa wa9e3\"), «بش نعاونك» (pas \"bech n3awnek\"), "
    "«في وش الأرضية» (pas \"wech t7eb\").\n"
    "Si l'utilisateur écrit en franco-arabe chiffré ou en français ou en fusha, tu réponds quand même en derja "
    "tunisienne écrite en vraies lettres arabes.\n"
    "\n"
    "VOCABULAIRE DERJA ESSENTIEL (à utiliser naturellement, EN ARABE) :\n"
    "  Salutations : صحة/صحة زيتو (bonjour), أسلمى (salut), لاباس؟ (ça va?), واش تعمل؟ (tu fais quoi?), "
    "  شكون كاين (qui est là), يخي (ok/voilà), صحيح (merci), علاش (bonne santé/merci), "
    "  صاحبة (au revoir), نشوفك بكري (à plus tard), ياوي/يا عيطي (affectueux).\n"
    "  Questions : شنو/شنوة (quoi), كيفاش (comment), وقتاش (quand), وين (où), "
    "  شكون (qui), علاش/علاشة (pourquoi), واش (qu'est-ce que), باش (pour/afin de), عندك (tu as), "
    "  تنجم (tu peux), باش تيجي (tu viendras).\n"
    "  Verbes : نحب/نحبك (j'aime/je veux, je t'aime), نطير (je pars), نرجع (je reviens), "
    "  نكلّم/نحكي (je parle), نسمع (j'écoute), نشوف (je vois/regarde), نخمّم (je pense), "
    "  نفهم (je comprends), نعاون (j'aide), نسكر (je ferme), نصوّر (je photographie).\n"
    "  Emotions : فرحان (heureux), عيان (fatigué), بزّية (triste/moche), مريقل/باهي (bien/super), "
    "  مليح (bon), يعطيك صحة (santé à toi), ربي يحفذك (que Dieu te garde - merci chaleureux).\n"
    "  Nourriture : مقان (table), كسكسي (couscous), حلالم (galette tunisienne), لابلابي, "
    "  البصل (oignons), لوز (amandes), زريقا (boisson), بريك, مقلوب, ملاوي.\n"
    "  Temps : البارح (hier), اليوم (aujourd'hui), غدوة (demain), توا (maintenant), "
    "  بكري (tôt), أتلا (plus tard), الأسبوع الجاي (la semaine prochaine).\n"
    "  Transitions : معلاش (ça va/pas grave), صححت (bien fait), بعيد (ensuite), "
    "  وبعيد (et puis), أما (mais), ليكن (mais), اللي (celui qui), كل (tout).\n"
    "\n"
    "STYLE D'EXPLICATION (IMPORTANT) :\n"
    "  - Sois EXPLICATIF : ne te contente pas d'une réponse sèche. Explique brièvement POURQUOI et COMMENT. "
    "    Ex: si on te demande l'heure, dis l'heure ET ajoute une remarque naturelle.\n"
    "  - Réponds en 3 à 6 phrases de derja claires et utiles, PAS des phrases coupées.\n"
    "  - Reformule ta compréhension si l'utilisateur n'est pas clair : «نفهمك باش نعمل... صح؟» (je comprends que tu veux... c'est ça?).\n"
    "  - Utilise des tournures natives comme : «راه عندي هكا...» (voilà j'ai ça), "
    "    «توا نشوفلك...» (je vais te trouver...), «عجبني هوا...» (ce que j'aime c'est...).\n"
    "  - Si tu dois proposer des options, propose-les clairement numérotées en derja : «1) ... 2) ...».\n"
    "  - Termine souvent par une question ouverte sympa pour continuer : «ونتي/نتا؟ شنو تحب تعمل؟»\n"
    "\n"
    "EXEMPLES DE TON NATUREL (TOUJOURS EN ARABE) :\n"
    "  «صحة زيتو! نتا واجد؟ شنو نعاونك بيه اليوم؟» (Salut! Tu es là? Qu'est-ce que je peux faire pour toi aujourd'hui?)\n"
    "  «يخي، فهمتك. توا نشوفلك عندك حاجة مريغة. شنو بالضبط؟»\n"
    "  «باهي باهي! ننجم نعمل حاجة كي تحب. قوللي الوقت.»\n"
    "  «معلاش، نحاول نفهم أكثر. علاش تستعمل هذه؟»\n"
    "\n"
    "RENFORTS DIALECTE TUNISIEN (utilise-les naturellement, JAMAIS de façon forcée) :\n"
    "  Adresse familière : يا خويا (mon frère), يا عزيزي (cher), يا بعدي (mon chéri, affectueux), "
    "  واِش نعاونك (que puis-je faire), تعيش/تعيشي (tu vis/longue vie, merci), عيشني (fais-moi plaisir).\n"
    "  Réactions du quotidien : برّشا/برشا (beaucoup), شويّة (un peu), مبّركة (félicitations), "
    "  صحّة (santé/bravo), مبروك مبروك, يهبل (incroyable), على عيني وراسي (volontiers), "
    "  ما عنديش مانع (pas de souci), خلينا نشوفو (voyons voir).\n"
    "  Verbes de tous les jours : ناخذ (je prends), نعطي (je donne), نقشد (je peux), نخدم (je travaille), "
    "  نتمشى (je me promène), ناكل (je mange), نشرب (je bois), نرقد (je dors), نقوم (je me lève), "
    "  نرجع (je reviens), نحرگ (je pars vite), نطيح (je tombe), نقرا (je lis/étudie).\n"
    "  Questions naturelles : إش قلت؟ (qu'est-ce que tu as dit?), قتلي (dis-moi), شنوّة؟ (quoi?), "
    "  كيفاش دخلت؟ (comment tu es venu?), واش درت؟ (qu'est-ce que tu as fait?), فين رايح؟ (où vas-tu?), "
    "  أش بيك؟ (qu'est-ce qui t'arrive?), واش خصّك؟ (de quoi tu as besoin?).\n"
    "  Intensité : باهي باهي (très bien), على آخر بيق (super), ما شاء الله (bravo/impressionnant), "
    "  الله يعطيك الصحة (merci chaleureux), ربي يسهّل (que Dieu facilite).\n"
    "  Tournures typiques tunisiennes : «خويا هذا مش بعيد» (mon frère ce n'est pas loin), "
    "  «باهي، خلينا نبداو» (bien, commençons), «شكون يقدر يعاونك؟» (qui peut t'aider?), "
    "  «هاك الساعة/النهار» (cette heure/ce jour), «مش هكا؟» (n'est-ce pas?).\n"
    "\n"
    "Tu aides pour : prix crypto/Binance, rendez-vous, rappels, messages WhatsApp, emails, planning, météo, infos générales.\n"
    "Pour une action, guide vers une demande précise comme «prends rendez-vous avec mon frère demain à 10h».\n"
    "En cas de doute, reformule en derja pour confirmer : «شنوّة حكيت؟» (qu'est-ce que tu as dit ?).\n"
    "IMPORTANT : réponds SEULEMENT en derja tunisienne, pas en français, même pour les questions en français."
)


def _cle_openrouter() -> str:
    return (config.OPENROUTER_API_KEY or "").strip() or os.environ.get("OPENROUTER_API_KEY", "").strip()


def trouver_url_travail(nom: str) -> str:
    """Demande a l'IA l'URL officielle d'un service (STEG, Sonede, etc.)."""
    if not _EN_LIGNE or not nom:
        return ""
    prompt = (
        f"Donne l'URL officielle du site web de « {nom} » (si c'est un service "
        "tunisien, utilise le domaine .com.tn ou .tn). Reponds UNIQUEMENT avec une "
        "URL http(s) valide, sans texte, sans explication. Si tu ne sais pas, "
        "reponds juste: INCONNU."
    )
    try:
        if _SOURCE == "openrouter":
            r = requests.post(
                config.OPENROUTER_URL,
                headers={
                    "Authorization": "Bearer " + _cle_openrouter(),
                    "Content-Type": "application/json",
                    "HTTP-Referer": "http://localhost",
                    "X-Title": "AssistantAI",
                },
                json={
                    "model": config.OPENROUTER_MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 40,
                    "temperature": 0.0,
                },
                timeout=15,
            )
            r.raise_for_status()
            url = (r.json()["choices"][0]["message"]["content"] or "").strip()
        elif _SOURCE == "ollama":
            r = requests.post(
                _OLLAMA + "/api/generate",
                json={"model": _MODELE_OLLAMA, "prompt": prompt, "stream": False,
                      "keep_alive": "30m", "options": {"temperature": 0.0, "num_predict": 40}},
                timeout=240,
            )
            r.raise_for_status()
            url = r.json().get("response", "").strip()
        else:
            return ""
    except Exception:
        return ""
    m = re.search(r"https?://[^\s,;]+", url)
    return m.group(0) if m else ""


def configurer() -> bool:
    """Detecte la source de cerveau disponible.

    STRATEGIE HYBRIDE :
      - OpenRouter avec modele GRATUIT (:free) en quotidien -> rapide, parle le
        dialecte, et ne renvoie jamais de 402 (modele libre). 
      - Ollama local en SECOURS : si OpenRouter est injoignable, OU si un appel
        OpenRouter echoue (402/429/erreur), on retombe sur le modele local.
    """
    global _EN_LIGNE, _SOURCE
    global _MODELE_OLLAMA
    # Toujours reperer un modele Ollama disponible (secours hors-ligne).
    try:
        r = requests.get(_OLLAMA + "/api/tags", timeout=3)
        if r.status_code == 200:
            noms = [m.get("name", "") for m in r.json().get("models", [])]
            for m in _MODELE_OLLAMA_PRIORITES:
                if any(n.startswith(m) for n in noms):
                    _MODELE_OLLAMA = m
                    break
    except Exception:
        pass
    # 1) Source principale : OpenRouter (modele :free, gratuit et rapide).
    if _cle_openrouter():
        try:
            r = requests.post(
                config.OPENROUTER_URL,
                headers={
                    "Authorization": "Bearer " + _cle_openrouter(),
                    "Content-Type": "application/json",
                    "HTTP-Referer": "http://localhost",
                    "X-Title": "AssistantAI",
                },
                json={
                    "model": config.OPENROUTER_MODEL,
                    "messages": [{"role": "user", "content": "test"}],
                    "max_tokens": 5,
                },
                timeout=20,
            )
            if r.status_code == 200:
                _SOURCE = "openrouter"
                _EN_LIGNE = True
                print("Cerveau IA: openrouter (modele " + config.OPENROUTER_MODEL + ")")
                return True
        except Exception:
            pass
    # 2) Secours : Ollama local (hors-ligne, gratuit, illimite).
    if _MODELE_OLLAMA:
        _SOURCE = "ollama"
        _EN_LIGNE = True
        print("Cerveau IA: ollama (modele " + _MODELE_OLLAMA + ")")
        return True
    _SOURCE = None
    _EN_LIGNE = False
    return False


def est_actif() -> bool:
    return _EN_LIGNE


def source() -> str:
    return _SOURCE or "aucune"


def _historique_recent(message: str, limite: int = 8) -> list:
    """Charge les derniers echanges (user/assistant) pour la memoire de Hmied."""
    try:
        from assistant import storage
        hist = []
        for c in storage.lister_conversations(limite):
            role = c.get("role")
            contenu = (c.get("contenu") or "").strip()
            if role in ("user", "assistant") and contenu:
                hist.append((role, contenu))
        # Eviter un doublon si le message courant a deja ete stocke (WhatsApp)
        if hist and hist[-1][0] == "user" and hist[-1][1].strip() == message.strip():
            hist.pop()
        return hist
    except Exception:
        return []


def generer(message: str, historique: list = None) -> str:
    """Genere une reponse de Hmied pour une question libre (avec memoire)."""
    if not _EN_LIGNE:
        return None
    if historique is None:
        historique = _historique_recent(message)
    if _SOURCE == "openrouter":
        rep = _generer_openrouter(message, historique)
        if rep:
            return rep
        if _MODELE_OLLAMA:
            print("OpenRouter indiponible -> bascule Ollama")
            return _generer_ollama(message, historique)
        return None
    return _generer_ollama(message, historique)


def _styles_appris() -> str:
    """Expressions derja que Hamdi emploie souvent, apprises automatiquement."""
    try:
        from assistant import apprentissage
        return apprentissage.extraire_style_pour_prompt()
    except Exception:
        return ""


def _dialecte_pour_prompt() -> str:
    """Dictionnaire de dialecte tunisien de Hamdi (derja.json) a injecter."""
    try:
        from assistant import dialecte
        return dialecte.texte_pour_prompt()
    except Exception:
        return ""


_PROMPT_EXTRACTION = (
    "Tu es un linguiste du dialecte tunisien (derja). Lit le message de l'utilisateur "
    "ci-dessous et EXTRAIS uniquement les mots/expressions derja tunisienne qui ont "
    "une saveur locale forte (salutations comme 'saha', 'aslema', expressions comme "
    "'ya khouya', '3lehech', 'kifech', verbes, questions, tournures orales). "
    "Ne conserve PAS les mots français banals, les nombres, ou les articles seuls. "
    "Renvoie UNIQUEMENT une liste d'expressions, une par ligne, sans numéros, sans "
    "explication. Si aucune expression derja, renvoie simplement: AUCUNE.\n"
    "Message: \"{message}\""
)


def extraire_style(message: str) -> list:
    """Demande a l'IA (OpenRouter ou Ollama) d'extraire les marques de style
    derja du message de l'utilisateur. Renvoie une liste d'expressions."""
    if not _EN_LIGNE:
        return []
    try:
        prompt = _PROMPT_EXTRACTION.format(message=message)
        if _SOURCE == "openrouter":
            r = requests.post(
                config.OPENROUTER_URL,
                headers={
                    "Authorization": "Bearer " + _cle_openrouter(),
                    "Content-Type": "application/json",
                    "HTTP-Referer": "http://localhost",
                    "X-Title": "AssistantAI",
                },
                json={
                    "model": config.OPENROUTER_MODEL,
                    "messages": [{"role": "system", "content": prompt}],
                    "max_tokens": 120,
                    "temperature": 0.2,
                },
                timeout=15,
            )
            r.raise_for_status()
            texte = (r.json()["choices"][0]["message"]["content"] or "").strip()
        elif _SOURCE == "ollama":
            r = requests.post(
                _OLLAMA + "/api/generate",
                json={
                    "model": _MODELE_OLLAMA,
                    "prompt": prompt,
                    "stream": False,
                    "keep_alive": "30m",
                    "options": {"temperature": 0.2, "num_predict": 120},
                },
                timeout=240,
            )
            r.raise_for_status()
            texte = r.json().get("response", "").strip()
        else:
            return []
    except Exception as e:
        print("Extraction style erreur:", type(e).__name__, str(e)[:80])
        return []
    if not texte or texte.upper().strip() == "AUCUNE":
        return []
    # Une expression par ligne, on nettoie les tirets/numéros/virgules
    import re as _re
    exprs = []
    for ligne in texte.splitlines():
        ligne = _re.sub(r"^[\s\d\.\-\*•]+", "", ligne).strip()
        if not ligne or ligne.upper() == "AUCUNE":
            continue
        # Decouper aussi sur virgules/points pour attraper plus d'items
        for part in _re.split(r"[,;•]", ligne):
            part = part.strip().lstrip("-*.")
            if part and len(part.split()) <= 4:
                exprs.append(part)
    return list(dict.fromkeys(exprs))


def _composer_systeme() -> str:
    """System prompt complet : personnalité + style appris + dictionnaire dialecte."""
    system = _SYSTEM
    dialecte = _dialecte_pour_prompt()
    if dialecte:
        system = system + "\n\n" + dialecte
    style = _styles_appris()
    if style:
        system = system + "\n\nAPPRIS DE HAMDI (imite ce style) : " + style
    return system


def _contenus_messages(message: str, historique: list) -> list:
    msgs = [{"role": "system", "content": _composer_systeme()}]
    for role, contenu in historique:
        msgs.append({"role": role, "content": contenu})
    msgs.append({"role": "user", "content": message})
    return msgs


def _systeme_ollama() -> str:
    """System prompt CONDENSE pour Ollama local (cpu lent). Le prompt complet
    ~2400 tokens depasse num_ctx=2048 et ralentit/trunque tout sur CPU."""
    return (
        "Tu es Hmied (حميد), assistant personnel qui aide Hamdi (حمدي), son maitre tunisien. "
        "Parle TOUJOURS en DERJA tunisienne en LETTRES ARABES ; JAMAIS en arabe litteraire, JAMAIS en chiffres "
        "(3=ع 7=ح 9=ق 5=خ 2=أ 8=غ interdits). Reponds court: 2-4 phrases de derja simples et utiles. "
        "Mots de la derja de Hamdi: صحة زيتو=bonjour, يعطيك الصحة=merci, ربي يحفظك=que Dieu te garde, "
        "خلينا نبداو=commencons, يا خويا=mon frere, يا عزيزي=mon cher, نعاونك=je t'aide, باش=pour que, "
        "توا=maintenant, غدوة=demain, البارح=hier, لاباس=ca va, معلاش=pas grave, مليح/باهي=bien, "
        "برشا=beaucoup, شوية=un peu, كيفاش=comment, وقتاش=quand, شنوّة/شنوة=quoi, نخمّم=je pense, "
        "نفهمك=je te comprends, على عيني وراسي=volontiers. Reponds naturellement comme un Tunisien du quotidien."
    )


def _construire_prompt(message: str, historique: list) -> str:
    lignes = [_systeme_ollama()]
    for role, contenu in historique:
        prefixe = "Utilisateur: " if role == "user" else "Hmied: "
        lignes.append(prefixe + contenu)
    lignes.append("Utilisateur: " + message)
    lignes.append("Hmied:")
    return "\n".join(lignes)


def _generer_openrouter(message: str, historique: list) -> str:
    try:
        r = requests.post(
            config.OPENROUTER_URL,
            headers={
                "Authorization": "Bearer " + _cle_openrouter(),
                "Content-Type": "application/json",
                "HTTP-Referer": "http://localhost",
                "X-Title": "AssistantAI",
            },
            json={
                "model": config.OPENROUTER_MODEL,
                "messages": _contenus_messages(message, historique),
                "max_tokens": 900,
                "temperature": 0.7,
                "top_p": 0.95,
            },
            timeout=60,
        )
        r.raise_for_status()
        data = r.json()
        return (data["choices"][0]["message"]["content"] or "").strip()
    except Exception as e:
        print("OpenRouter erreur/timeout:", type(e).__name__, str(e)[:80])
        return None


def _generer_ollama(message: str, historique: list) -> str:
    try:
        prompt = _construire_prompt(message, historique)
        r = requests.post(
            _OLLAMA + "/api/generate",
            json={
                "model": _MODELE_OLLAMA,
                "prompt": prompt,
                "stream": False,
                "keep_alive": "30m",
                "options": {"temperature": 0.4, "num_ctx": 2048, "num_predict": 120, "top_p": 0.95, "frequency_penalty": 0.3},
            },
            timeout=240,
        )
        r.raise_for_status()
        return r.json().get("response", "").strip()
    except Exception as e:
        print("Ollama erreur:", e)
        return None
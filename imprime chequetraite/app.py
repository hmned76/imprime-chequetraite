"""
AssistantAI - Serveur web local.

Lancez avec :  python app.py
Ouvrez ensuite http://127.0.0.1:5000 (ou l'IP de votre PC depuis le telephone).
"""

import os
import sys

os.environ.setdefault("HF_HOME", r"D:\assistantAI\.cache\huggingface")
os.environ.setdefault("HUGGINGFACE_HUB_CACHE", r"D:\assistantAI\.cache\huggingface")
os.environ.setdefault("OLLAMA_MODELS", r"D:\assistantAI\.ollama")

import functools
import hmac

from flask import Flask, render_template, request, jsonify, Response, redirect, make_response

import config
from assistant import engine, storage, ia
from assistant.integrations import envoyer_email
from assistant.whatsapp_connector import envoyer_whatsapp as wa_envoyer, demarrer_whatsapp_monitor, arreter_whatsapp_monitor, traiter_message_whatsapp, verifier_signature_webhook, enregistrer_webhook
from assistant import trading
from assistant import meteo


def _version_pc() -> str:
    """Lit la version depuis android/gradle.properties (ex: 3.0.57)."""
    try:
        p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "android", "gradle.properties")
        base = "3.0"
        num = ""
        with open(p, encoding="utf-8", errors="ignore") as f:
            for line in f:
                line=line.strip()
                if line.startswith("buildNumber"):
                    num = line.split("=",1)[1].strip()
                if line.startswith("versionBase"):
                    base = line.split("=",1)[1].strip()
        # fallback: lire versionBase depuis app/build.gradle si pas dans properties
        if not num:
            return base
        return f"{base}.{num}"
    except: return "3.0"

def _base_path() -> str:
    """Retourne le bon dossier racine (normal ou exe PyInstaller)."""
    if getattr(sys, "frozen", False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))


app = Flask(__name__, template_folder=os.path.join(_base_path(), "templates"))
app.config.update(TEMPLATES_AUTO_RELOAD=True, SEND_FILE_MAX_AGE_DEFAULT=0)


@app.after_request
def _no_cache(resp):
    """Forcer le rechargement de l'interface (WebView du téléphone)."""
    resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    resp.headers["Pragma"] = "no-cache"
    return resp


# ---------------------------------------------------------------------------
# Securite : authentification par token partage
# ---------------------------------------------------------------------------
# Les webhooks WhatsApp (appeles par Maytapi/WhatsApp, pas par l'utilisateur)
# restent publics : ils sont proteges par leur propre signature Webhook.
PUBLIC_PATHS = {
    "/api/whatsapp/webhook",
    "/api/whatsapp/webhook/register",
    "/api/whatsapp/monitor/start",
    "/api/whatsapp/monitor/stop",
    "/api/whatsapp/monitor/statut",
    "/api/whatsapp/envoyer",
    "/api/login",
}


def _verifier_token() -> bool:
    """Compare l'en-tete X-Auth-Token (ou query ?token=) au token configure,
    via comparaison a temps constant (anti-timing-attack)."""
    fourni = request.headers.get("X-Auth-Token", "") or request.args.get("token", "")
    if not fourni or not config.AUTH_TOKEN:
        return False
    try:
        return hmac.compare_digest(fourni, config.AUTH_TOKEN)
    except Exception:
        return False


@app.before_request
def _proteger_api():
    """Verifie le token sur toutes les routes /api/* sauf les webhooks publics.
    Accepte soit l'en-tete X-Auth-Token (APK), soit le cookie de session web."""
    path = request.path
    if not path.startswith("/api/") or path in PUBLIC_PATHS:
        return None
    if not (_verifier_token() or _connexion_ok()):
        return jsonify({"erreur": "Acces refuse : token invalide ou manquant."}), 401
    return None


def _connexion_ok() -> bool:
    """L'interface web est-elle connectee (cookie valide) ?"""
    cookie = request.cookies.get("auth", "")
    return bool(cookie) and hmac.compare_digest(cookie, config.AUTH_TOKEN)


@app.before_request
def _proteger_web():
    """Protege la page web: sans connexion -> renvoie un token dans l'URL
    par un lien /?token=... verifie une fois (cf. route login)."""
    if request.path != "/" or _connexion_ok():
        return None
    return None

# On pointe la base de donnees dans le dossier d'execution
storage.DB_PATH = os.path.join(_base_path(), "db", "assistant.db")
storage.initialiser()
ia.configurer()
print("Cerveau IA:", ia.source())

# Ajouter les travaux (STEG, Sonede, Telecom...) connus par defaut
try:
    from assistant import travaux
    travaux.initialiser_defauts()
    print("Travaux par defaut initialises")
except Exception as e:
    print("Erreur init travaux:", e)

# Demarrer le monitor WhatsApp en arriere-plan
demarrer_whatsapp_monitor()
print("WhatsApp monitor lance")

# Enregistrer le webhook WhatsApp avec l'URL publique courante
try:
    print("Webhook WhatsApp:", enregistrer_webhook())
except Exception as e:
    print("Erreur enregistrement webhook:", e)


def _extraire_ville_meteo(message: str) -> str:
    """Extrait le nom de ville d'un message meteo. Defaut : Tunis."""
    t = message.lower()
    import re as _re
    # Arabe : « الطقس في باريس » / « في تونس » -> mot apres في
    # on prend le DERNIER "في X" pour éviter "الطقس في ..." vide
    cand_ar = _re.findall(r"في\s+([\u0600-\u06FF]{2,})", t)
    if cand_ar:
        # filtrer mots vides type "صفاقس؟"
        for c in reversed(cand_ar):
            c = _re.sub(r"[^\u0600-\u06FF]", "", c).strip()
            if len(c) >= 2 and c not in {"الطقس","الجو","حرارة"}:
                return c
    m = _re.findall(r"\b(?:a|à|de|en|sur|sous|pour)\s+([a-záàâäéèêëîïôöûüç'-]{2,})", t)
    ignorer = {"demain", "aujourd", "maintenant", "lundi", "mardi", "mercredi",
               "jeudi", "vendredi", "samedi", "dimanche", "soir", "matin", "midi",
               "nuit", "la", "le", "ce", "cette", "mon", "ma", "meteo", "météo",
               "temps", "climat", "pluie", "soleil", "ville"}
    for candidat in reversed(m):
        cand = candidat.strip(".,!?;:").lower()
        if cand not in ignorer and len(cand) >= 2:
            return cand.capitalize()
    # Fallback : dernier mot qui ressemble à une ville (ex: "meteo sfax")
    mots = _re.findall(r"[a-záàâäéèêëîïôöûüç'-]{3,}", t)
    stop_fallback = {"donne","donner","quelle","quel","pour","avec","faire","info","infos","moi","toi","la","le","les","ma","mon","mes","une","un","des","du","notre","votre","elle","il","sur","sous","en","a","à","de","informations","information","des","sour"}
    for cand in reversed(mots):
        if cand not in ignorer and cand not in stop_fallback:
            # éviter de reprendre "meteo" déjà filtré
            return cand.capitalize()
    return "Tunis"

def _resoudre_numero(contact: str) -> str:
    """Retrouve un numero de telephone dans config.CONTACTS en ignorant les
    accents et les formules type « mon frere », « le medecin »..."""
    import unicodedata as _uni
    t = (contact or "").lower()
    # Normalisation des accents : "frère" -> "frere", "médécin" -> "medecin"
    def _norm(s: str) -> str:
        return "".join(c for c in _uni.normalize("NFD", s) if _uni.category(c) != "Mn")
    # Candidats : phrase complete, sans formules, dernier mot, sans "Contact"
    candidats = [_norm(t)]
    for formule in ["mon frere", "ma soeur", "mon", "ma", "le docteur", "docteur",
                    "dr", "le", "la", "monsieur", "madame", "mme"]:
        ft = _norm(formule)
        if ft and t.startswith(ft + " "):
            reste = _norm(t[len(formule):].strip())
            if reste:
                candidats.append(reste)
    derniers = _norm(t).split()
    if derniers:
        candidats.append(derniers[-1])
        if len(derniers) >= 2:
            candidats.append(derniers[-2])
    for cle, num in config.CONTACTS.items():
        cle_n = _norm(cle.lower())
        if cle_n in candidats:
            return str(num)
        # accepte aussi "mohamed" trouve dans "appeler mohamed maintenant"
        for cand in candidats:
            if cand and (cle_n in cand or cand in cle_n):
                return str(num)
    return ""

def _traiter_demande(message: str):
    resultat = engine.executer(message, config.NOM_ASSISTANT, config.MODE)
    intention = resultat["intention"]
    reponse = resultat["reponse"]
    infos = resultat["infos"]

    # Apprentissage automatique : Hmied releve le style derja de Hamdi et
    # le stocke, pour lui repondre avec SON vocabulaire (plus naturel/rapide).
    try:
        from assistant import apprentissage
        apprentissage.apprendre_depuis_message(message)
    except Exception as e:
        print("Apprentissage erreur:", type(e).__name__, str(e)[:120])

    # Gestion des "travaux" : si l'utilisateur demande d'ajouter un service
    # (STEG, Sonede...) au menu, on l'ajoute et on repond directement.
    try:
        from assistant import travaux
        res_travail = travaux.gerer_message(message)
    except Exception as e:
        print("Travaux erreur:", type(e).__name__, str(e)[:120])
        res_travail = None
    if res_travail is not None:
        storage.ajouter_conversation("user", message, "travail")
        storage.ajouter_conversation("assistant", res_travail["reponse"], "travail")
        return {"reponse": res_travail["reponse"], "intention": "travail", "actions": []}

    # Cerveau IA pour les demandes libres et les salutations personnalisees
    # (une simple salutation "saha" garde la reponse rapide locale, mais une
    # formulation libre comme "je veux saluer ma collegue..." passe par l'IA
    # qui parle mieux la derja)
    utiliser_ia = (intention == "question") or (
        intention == "salutation" and len(message.split()) >= 4)
    # Recherche web generale : pour toute question libre, Hmied va consulter
    # le web (sites du monde entier) puis resume avec l'IA.
    if intention == "question":
        try:
            from assistant import recherche
            rep_web = recherche.repondre_question(message)
            if rep_web:
                reponse = rep_web
                persistante_question = True
        except Exception as e:
            print("Recherche web erreur:", e)
    if utiliser_ia and ia.est_actif() and not locals().get("persistante_question"):
        try:
            llm = ia.generer(message)
            if llm:
                reponse = llm
        except Exception as e:
            print("IA erreur:", e)

    # Force meteo si mot cle detecte mais intention ratee (robustesse contre LLM)
    if intention != "meteo" and any(k in message.lower() for k in ["meteo","météo","طقس","حرارة","weather","temperature","احوال","حالة"]):
        intention = "meteo"
    # Meteo reelle : si l'utilisateur demande la meteo, on interroge l'API meteo
    # (Open-Meteo) au lieu de laisser l'IA halluciner.
    if intention == "meteo":
        try:
            ville = _extraire_ville_meteo(message)
            reponse = meteo.texte_meteo(ville)
        except Exception as e:
            print("Meteo erreur:", e)
            reponse = "Désolé, je n'ai pas pu obtenir la météo : " + str(e)

    # Actions externes selon l'intention (WhatsApp / email / rdv / trading)
    actions = []
    if intention == "whatsapp":
        contact = infos.get("contact") or "le contact"
        corps = infos.get("texte") or reponse
        # Resoudre le nom du contact vers un numero de telephone (config.CONTACTS)
        cle_contact = contact.lower().split()[-1]
        numero = config.CONTACTS.get(cle_contact, config.CONTACTS.get(contact.lower(), ""))
        destinataire = numero or contact
        res = wa_envoyer(destinataire, corps)
        actions.append({"type": "whatsapp", "resultat": res})
        if res.get("statut") == "simu":
            reponse = (f"(Simulation) Message WhatsApp prêt pour {contact} : « {corps} ». "
                       "Configure un fournisseur dans config.py (Maytapi/360dialog) pour un vrai envoi.")
        elif res.get("statut") == "erreur":
            reponse = f"⚠️ WhatsApp réel a échoué : {res.get('details', 'erreur inconnue')}"
    elif intention == "email":
        res = envoyer_email("Message d'AssistantAI", infos.get("texte") or reponse)
        actions.append({"type": "email", "resultat": res})
    elif intention == "rdv":
        titre = f"RDV avec {infos.get('contact') or 'contact'}"
        debut = f"{infos.get('jour')}T{infos.get('heure') or '10:00'}:00"
        rid = storage.ajouter_evenement(titre, debut)
        actions.append({"type": "rdv", "resultat": {"id": rid, "debut": debut}})
    elif intention == "trading":
        try:
            res = trading.executer_investissement(message)
            reponse = res["reponse"]
            actions.append({"type": "trading", "resultat": res})
        except Exception as e:
            reponse = f"L'analyse Binance a échoué : {e} (vérifie ta connexion internet)."
    elif intention == "call":
        c = infos.get("contact") or "le contact"
        numero = _resoudre_numero(c)
        if not numero:
            reponse = (f"Je n'ai pas le numéro de {c} dans mes contacts. "
                       "Ajoute-le dans config.py (CONTACTS) et je t'appellerai à ce moment-là.")
        else:
            actions.append({"type": "call", "resultat": {"numero": numero, "contact": c}})
            reponse = f"Je vais appeler {c} des maintenant."

    # Persistance des deux cotes de la conversation
    storage.ajouter_conversation("user", message, intention)
    storage.ajouter_conversation("assistant", reponse, intention)

    return {"reponse": reponse, "intention": intention, "actions": actions}


@app.route("/")
def index():
    # Connexion web : si token valide dans l'URL -> pose le cookie et redirige
    qtoken = request.args.get("token", "")
    if qtoken and hmac.compare_digest(qtoken, config.AUTH_TOKEN):
        resp = make_response(redirect(request.path))
        resp.set_cookie("auth", config.AUTH_TOKEN, httponly=True,
                        samesite="Lax", max_age=60 * 60 * 24 * 30)
        return resp
    if not _connexion_ok():
        return render_template("login.html", nom_assistant=config.NOM_ASSISTANT)
    conversations = storage.lister_conversations()
    return render_template(
        "index.html",
        conversations=conversations,
        nom_assistant=config.NOM_ASSISTANT,
        mode=config.MODE,
        version=_version_pc(),
    )


@app.route("/admin")
def admin():
    if not _connexion_ok():
        return render_template("login.html", nom_assistant=config.NOM_ASSISTANT)
    return render_template("admin.html", nom_assistant=config.NOM_ASSISTANT)


@app.route("/api/login", methods=["POST"])
def api_login():
    """Verifie le code saisi sur la page de connexion et pose le cookie auth."""
    data = request.get_json(silent=True) or {}
    code = str(data.get("code", ""))
    if hmac.compare_digest(code, config.AUTH_TOKEN):
        resp = make_response(jsonify({"ok": True}))
        resp.set_cookie("auth", config.AUTH_TOKEN, httponly=True,
                        samesite="Lax", max_age=60 * 60 * 24 * 30)
        return resp
    return jsonify({"ok": False, "erreur": "mot de passe incorrect"}), 401


@app.route("/api/infos")
def api_infos():
    """Identite et version partagees (PC et APK) : la page web affiche la meme
    version que l'application Android."""
    return jsonify({
        "nom": getattr(config, "NOM_ASSISTANT", "Hmied حميد"),
        "version": "v" + _version_pc(),
        "mode": getattr(config, "MODE", "simu"),
    })


@app.route("/api/chat", methods=["POST"])
def api_chat():
    data = request.get_json(silent=True) or {}
    message = (data.get("message") or "").strip()
    if not message:
        return jsonify({"erreur": "message vide"}), 400
    resultat = _traiter_demande(message)
    return jsonify(resultat)


@app.route("/api/stt", methods=["POST"])
def api_stt():
    """Reconnait la parole (francais ou arabe tunisien) a partir du fichier audio envoye par l'APK."""
    audio = request.get_data(cache=False)
    if not audio or len(audio) < 500:
        return jsonify({"texte": ""}), 400
    try:
        from assistant import stt
        texte = stt.transcrire(audio)
        return jsonify({"texte": texte})
    except Exception as e:
        return jsonify({"erreur": str(e)}), 500


@app.route("/api/tts", methods=["POST"])
def api_tts():
    """Synthetise la reponse en MP3 avec une voix Microsoft naturelle (homme fr/ar)."""
    data = request.get_json(silent=True) or {}
    texte = (data.get("texte") or "").strip()
    if not texte:
        return jsonify({"erreur": "texte vide"}), 400
    import re
    if re.search(r"[\u0600-\u06FF]", texte):
        voix = "ar-SA-HamedNeural"
    else:
        voix = "fr-FR-HenriNeural"
    try:
        import asyncio
        import edge_tts

        async def _synthetiser():
            buffer = bytearray()
            async for c in edge_tts.Communicate(texte, voix).stream():
                if c["type"] == "audio":
                    buffer.extend(c["data"])
            return bytes(buffer)

        chunks = asyncio.run(_synthetiser())
        return Response(chunks, mimetype="audio/mpeg",
                        headers={"Cache-Control": "no-store"})
    except Exception as e:
        return jsonify({"erreur": str(e)}), 500


@app.route("/api/conversations")
def api_conversations():
    return jsonify(storage.lister_conversations())


@app.route("/api/travaux", methods=["GET"])
def api_travaux_liste():
    return jsonify(storage.lister_travaux())


@app.route("/api/travaux", methods=["POST"])
def api_travaux_ajouter():
    data = request.get_json(silent=True) or {}
    nom = (data.get("nom") or "").strip()
    url = (data.get("url") or "").strip()
    if not nom or not url:
        return jsonify({"erreur": "nom et url requis"}), 400
    if not url.lower().startswith(("http://", "https://")):
        url = "https://" + url
    storage.ajouter_travail(nom, url)
    return jsonify({"statut": "ok", "travaux": storage.lister_travaux()})


@app.route("/api/travaux/<int:travail_id>", methods=["DELETE"])
def api_travaux_supprimer(travail_id):
    ok = storage.supprimer_travail(travail_id)
    if not ok:
        return jsonify({"erreur": "travail introuvable"}), 404
    return jsonify({"statut": "ok", "travaux": storage.lister_travaux()})


@app.route("/api/historique", methods=["POST"])
def api_historique():
    """Recoit l'historique des discussions envoye par l'app Android (mode autonome)
    pour le retrouver sur le PC. Chaque message est ajoute a la base de conversations."""
    data = request.get_json(silent=True) or {}
    messages = data.get("messages") or []
    if not messages and data.get("role") and data.get("contenu"):
        # Compatible aussi avec un message unique {role, contenu} (page web).
        messages = [{"role": data.get("role"), "texte": data.get("contenu")}]
    if not isinstance(messages, list):
        return jsonify({"erreur": "messages doit etre une liste"}), 400
    ajoutes = 0
    for m in messages:
        role = (m.get("role") or "").strip()
        texte = (m.get("texte") or "").strip()
        if not role or not texte:
            continue
        role = "user" if role == "user" else "assistant"
        storage.ajouter_conversation(role, texte, "mobile")
        ajoutes += 1
    return jsonify({"statut": "ok", "ajoutes": ajoutes})


@app.route("/api/events")
def api_events():
    return jsonify(storage.lister_evenements())


@app.route("/api/contacts")
def api_contacts():
    return jsonify(storage.lister_contacts())


@app.route("/api/prix")
def api_prix():
    symbole = request.args.get("symbol", config.BINANCE_COIN_DE_BASE)
    try:
        return jsonify({"symbole": symbole, "prix": trading.obtenir_prix(symbole)})
    except Exception as e:
        return jsonify({"erreur": str(e)}), 502


@app.route("/api/analyse")
def api_analyse():
    symbole = request.args.get("symbol", config.BINANCE_COIN_DE_BASE)
    try:
        return jsonify(trading.analyser_marche(symbole))
    except Exception as e:
        return jsonify({"erreur": str(e)}), 502


@app.route("/api/portfolio")
def api_portfolio():
    return jsonify(trading.valeur_portefeuille())


@app.route("/api/trade", methods=["POST"])
def api_trade():
    data = request.get_json(silent=True) or {}
    symbole = data.get("symbol") or config.BINANCE_COIN_DE_BASE
    cote = (data.get("side") or "ACHAT").upper()
    montant = float(data.get("amount") or (config.BINANCE_CAPITAL_INITIAL / 5))

    if config.BINANCE_PAPER:
        return jsonify(trading.trader_paper(symbole, cote, montant))
    return jsonify(trading.ordre_reel(symbole, cote, montant))


@app.route("/api/whatsapp/webhook", methods=["GET"])
def wa_webhook_verify():
    """Verification du webhook (GET pour l'inscription chez le fournisseur)."""
    mode = request.args.get("mode")
    token = request.args.get("hub.verify_token")
    challenge = request.args.get("hub.challenge")
    secret = config.WA_WEBHOOK_SECRET
    if mode == "subscribe" and token == secret:
        return challenge, 200
    return "Forbidden", 403


@app.route("/api/whatsapp/webhook", methods=["POST"])
def wa_webhook_incoming():
    """Reception d'un message WhatsApp entrant via webhook."""
    data = request.get_json(silent=True) or {}
    if not data:
        return jsonify({"erreur": "donnees vides"}), 400

    # Verification de la signature si configure
    signature = request.headers.get("X-Signature", "")
    if signature and config.WA_WEBHOOK_SECRET:
        payload = request.get_data()
        if not verifier_signature_webhook(payload, signature):
            return jsonify({"erreur": "signature invalide"}), 403

    try:
        resultat = traiter_message_whatsapp(data)
        return jsonify(resultat)
    except Exception as e:
        print("WA webhook erreur:", e)
        return jsonify({"erreur": str(e)}), 500


@app.route("/api/whatsapp/webhook/register", methods=["POST"])
def wa_webhook_register():
    """Re-enregistre le webhook WhatsApp (apres changement d'URL du tunnel)."""
    return jsonify(enregistrer_webhook())


@app.route("/api/whatsapp/monitor/start", methods=["POST"])
def wa_monitor_start():
    """Demarre le polling des messages WhatsApp en arriere-plan."""
    demarrer_whatsapp_monitor()
    return jsonify({"statut": "ok", "message": "WhatsApp monitor demarre"})


@app.route("/api/whatsapp/monitor/stop", methods=["POST"])
def wa_monitor_stop():
    """Arrete le polling des messages WhatsApp."""
    arreter_whatsapp_monitor()
    return jsonify({"statut": "ok", "message": "WhatsApp monitor arrette"})


@app.route("/api/whatsapp/monitor/statut", methods=["GET"])
def wa_monitor_statut():
    """Statut du monitor WhatsApp."""
    from assistant.whatsapp_connector import _wa_monitor
    return jsonify({"actif": _wa_monitor.actif})


@app.route("/api/whatsapp/envoyer", methods=["POST"])
def wa_envoyer_manual():
    """Envoi manuel d'un message WhatsApp."""
    data = request.get_json(silent=True) or {}
    dest = data.get("destinataire", "")
    message = data.get("message", "")
    if not dest or not message:
        return jsonify({"erreur": "destinataire et message requis"}), 400
    res = wa_envoyer(dest, message)
    return jsonify(res)


if __name__ == "__main__":
    print("AssistantAI demarre sur http://127.0.0.1:%d" % config.PORT)
    print("Depuis ton telephone (meme Wi-Fi) : http://<IP-DU-PC>:%d" % config.PORT)
    try:
        from assistant import ia
        ia.configurer()
        print("Cerveau IA actif:", ia.source())
    except Exception as e:
        print("Init IA:", e)
    app.run(host=config.HOST, port=config.PORT, debug=False)
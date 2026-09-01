"""
Moteur IA d'AssistantAI.

Comprend des messages en Tunisien (melange francais-arabe), detecte
l'intention (rdv, message whatsapp, rappel, planning, bonjour, etc.),
construit une reponse et renvoie les actions a executer.
Un vrai LLM (OpenAI/Claude) pourra remplacer la partie regles plus tard.
"""

import re
from datetime import datetime, timedelta

# LEXIQUE : mots tunisiens de base -> comprehension
LEXIQUE_TN = {
    "ya3ni": "c'est-a-dire", "chwiya": "un peu", "saha": "bonjour/sante",
    "bladi": "mon pays", "3ayech": "comment vas-tu", "labes": "ça va",
    "bnina": "bon", "chedda": "la fête/le dejeuner", "balech": "rien/ne t'embete pas",
    "wali": "tu vois", "ima": "maman", "baba": "papa", "khouya": "mon frere",
    "okhti": "ma sœur", "belek": "attention", "tawahit": "tu as peur",
    "squie": "detends-toi", "zahma": "probleme", "fhemka": "je t'ai compris",
    "ma fhemtesh": "tu n'as pas compris", "a3mal": "fais", "ash": "quoi",
    "kifesh": "comment", "yezzi": "assez", "barsha": "beaucoup",
    "wahda": "un", "zoz": "deux", "tlatha": "trois", "rb3a": "quatre",
    "khamsa": "cinq", "souda": "six", "sb3a": "sept", "thmaniya": "huit",
    "ts3ud": "neuf", "3achra": "dix", "hadi": "ceci/c'est", "hina": "ici",
    "houna": "la-bas", "l3eb": "le travail", "dkra": "souviens-toi",
    "trad": "va-t-en", "zid": "ajoute", "khli": "laisse",
    "selem": "paix/salut", "mrhba": "bienvenu", "tekhtar": "choisis",
    "tsawer": "ecris", "qra": "lit", "sme3": "ecoute",
    "nhar": "jour", "leyl": "nuit", "bhar": "matin", "3shiya": "soir",
    "yaoum": "jour", "njom": "nuit", "tempiya": "temperature",
    "csma": "soleil", "ghada": "pluie", "borj": "tour", "sayara": "voiture",
    "darb": "route", "makan": "lieu", "waqt": "temps/heure",
    "daba": "maintenant", "ghadya": "demain", "elahor": "maintenant",
    "fi3l": "faire", "mshy": "marche", "t9mel": "termine",
    "t9adem": "continue", "a9wal": "d'abord", "bel3eb": "au travail",
    "fi rjal": "dans la maison", "m3a": "avec", "b9ida": "loin",
    "qrib": "presse", "7ajr": "pierre", "hbib": "ami", "s7eb": "compagnon",
    "ra7eb": "voisin", "gherma": "cousin", "khta": "cousine",
    "m3amera": "oncle", "3amha": "tante", "bent": "fille", "weld": "garcon",
    "bint": "fille", "yezid": "ajouter", "nazel": "venir", "mshi": "marcher",
    "ktab": "livre", "daira": "cercle/arrondissement", "wilaya": "region",
    "baladiyya": "mairie", "souk": "marche", "masraf": "banque",
    "hospital": "hopital", "mdrasa": "ecole", "jom3a": "mosquee",
    "cafe": "cafe", "reshto": "restaurant", "hayat": "vie", "rahma": "miseration",
    "hiber": "sleepless", "rahlet": "fatigue", "3tisa": "as-tu",
    "3andek": "tu as", "3andia": "j'ai", "m3ak": "avec toi", "m3aya": "avec moi",
    "ghir": "juste", "kolchi": "tout", "wa7ad": "un", "lwan": "couleur",
    "kber": "grand", "sghir": "petit", "zain": "beau", "khayeb": "mauvais",
    "yyen": "il/elle", "nahki": "je", "entek": "tu", "howa": "il", "hiya": "elle",
    "ahna": "nous", "huma": "ils", "nifsek": "toi", "rask": "ton", "mrak": "ta",
    "rak": "tu as", "mra": "femme", "rajel": "homme", "timssa7": "demander",
    "t9eddem": "apprendre", "t9arraf": "connaitre", "t9allam": "enseigner",
    "n7eb": "j'aime", "ma n7ebch": "je n'aime pas", "bghit": "je veux",
    "nbghit": "je veux", "n9adhem": "je peux", "lah": "non", "eh": "oui",
    "na3m": "d'accord", "mish": "ne pas", "mach": "ne pas",
    "w3ad": "un peu", "bar9": "beaucoup", "tfat7": "ouvrir", "tferm": "fermer",
    "tqra": "lire", "tkhudh": "prendre", "tbalagh": "envoyer",
    "t7addeth": "appeler", "twaskil": "utiliser", "t9addam": "rester",
    "tjaw": "aller", "jawab": "reponse", "khemma": "les deux", "zad": "ajoute",
    "yanss": "il connait", "ya3ref": "il sait", "ya3refk": "il sait (te)",
    "ya3refni": "il sait (me)", "ya3refkom": "il sait (vous)",
    "fhem": "comprendre", "fhemek": "comprendre (te)", "fhemni": "comprendre (me)",
    "fhemkom": "comprendre (vous)", "t3arf": "sais-tu", "ta3ref": "est-ce que tu sais",
    "fin": "où", "ach": "quoi", "kifak": "comment tu", "kifakom": "comment vous",
    "ashkan": "comment", "9bal": "avant", "ba3d": "après", "feqd": "pendant",
    "ma9bl": "avant", "ba3dha": "après", "awwel": "premier", "tani": "deuxième",
    "tsael": "troisième", "rb3i": "quatrième", "khamsi": "cinquième",
    "soudi": "sixième", "sb3i": "septième", "thmani": "huitième",
    "ts3udi": "neuvième", "3achri": "dixième", "nishan": "signe",
    "karaha": "tâche", "t3amira": "tâche", "w2ed": "j'ai promis", "mel": "miel",
    "ghorba": "étranger", "djebali": "montagne", "saheli": "côte", "ardh": "terre",
    "bahr": "mer", "neb9": "ciel", "nujom": "étoiles", "qamar": "lune",
    "shams": "soleil", "twas9a": "heure", "dakika": "minute", "thnia": "demi",
    "rab3a": "quart", "tkhmsa": "cinq", "ts9od": "neuf", "3achra": "dix",
    "9achratin": "vingt", "tkhmissin": "cinquante", "miya": "cent", "alf": "mille",
    "mjoz": "moitié", "qwi": "fort", "dh3af": "faible", "safi": "suffisant",
    "taman": "assez", "r7y": "rêve", "hbss": "souvenir", "fkr": "pense",
    "tfa99al": "essaye", "t9awwaj": "répète", "tksb": "écrit",
    "t9ul": "dit", "t9awl": "commence", "tkammel": "termine",
    "t9addem": "continue", "tjarreb": "rappelle", "t3allem": "enseigne",
    "t9awan": "travaille",     "t9aleb": "fait", "t9alebh": "fais-le",
    "t9albih": "fais-le", "t9alebha": "fais-la", "t9alebhom": "fais-les",
    "t9alebki": "fais (tu)", "t9albi": "fais (je)", "t9albu": "fais (nous)",
    "t9albhum": "fais (ils)", "hwaya": "lui", "homuma": "eux",
    "tji": "viens", "t9adhab": "pars", "t9allal": "donne",
    "t9awd": "rends", "t9achor": "cherche",
}

def _nettoyer_texte(t: str) -> str:
    """Normalise un peu le texte : minuscules, espaces, accents legers."""
    return t.strip().lower()

def _contient(text: str, mots: list) -> bool:
    return any(m in text for m in mots)


def _mot_entier(text: str, mot: str) -> bool:
    """Vrai si 'mot' apparait comme MOT ENTIER (entoure de separates/espaces/debut/fin).
    Evite les faux positifs type 'mail' dans 'ismail'."""
    import re as _re
    return bool(_re.search(r"(^|[\s.,;:!?\-\/])" + _re.escape(mot) + r"($|[\s.,;:!?\-\/])", text))


def _est_email(text: str) -> bool:
    """Detecte une demande d'email. Exige que 'mail'/'email' soient des mots entiers
    (pas des bouts de 'ismail'/'jmail') ou un terme arabe clair."""
    if _mot_entier(text, "mail") or _mot_entier(text, "email"):
        return True
    if _contient(text, ["ecris a", "اكتب", "ايميل"]):
        return True
    return False


def _est_meteo(text: str) -> bool:
    """Detecte une demande de meteo (francais, derja, arabe)."""
    # Francais / latin - élargi
    if _contient(text, ["meteo", "météo", "weather", "il fait quoi", "temps qu'il", "temps qu il",
                        "fera-t-il", "pluv", "soleil aujourd", "temperature a", "temperature",
                        "quel temps", "le climat", "appelle meteo", "infos meteo", "info meteo"]):
        return True
    # Arabe / derja - élargi
    if _contient(text, ["طقس", "الجو", "شمس", "ماطر", "تمطر", "امطار", "تسخان",
                        "نحب نعرف الجو", "الطقس", "حرارة", "احوال", "حالة الطقس", "أحوال"]):
        return True
    # "temps" seul est ambigu -> on exige un peu de contexte meteo
    if _mot_entier(text, "temps") and _contient(text, ["aujourd", "demain", "maintenant", "donc"]):
        return True
    return False

def _extraire_contact(text: str) -> str:
    """Recupere le nom de la personne a contacter (ex: 'mon frere Mohamed')."""
    t = text.lower()
    # On coupe avant les marqueurs de message pour ne pas les prendre pour un nom
    for mq in ["dis-lui", "dis lui", "dislui", "qouli", "lou", "colha"]:
        if mq in t:
            t = t.split(mq)[0]
            break
    # Mots parasites a exclure en fin de nom (adverbes, politesse, temps...)
    mots_stop = {"a", "le", "la", "de", "du", "pour", "demain", "apres", "après",
                 "soir", "matin", "aujourd", "tout", "mon", "ma", "maintenant",
                 "des", "sil", "si", "s", "te", "plait", "plais", "stp", "svp",
                 "s'il", "le", "la", "les", "dès"}
    # 1) Motif avec article possessif/demonstratif : "mon frere", "le medecin"...
    m = re.search(r"(?:avec\s+)?(?:mon|ma|le|la|ton|ta|mes)\s+(?P<qui>[a-z\u00e0-\u017f]+)(?:\s+(?P<nom>[a-z\u00e0-\u017f]+))?", t)
    if m:
        mots_stop = {"a", "le", "la", "de", "du", "pour", "demain", "apres",
                     "soir", "matin", "aujourd", "tout", "mon", "ma", "maintenant",
                     "des", "sil", "stp", "svp", "s", "te", "plait"}
        qui = m.group("qui")
        nom = m.group("nom")
        if nom and nom not in mots_stop:
            return f"{qui.capitalize()} {nom.capitalize()}".strip()
        if qui not in mots_stop:
            return qui.capitalize()
    # 2) Motif direct apres un verbe d'appel : "appelle Mohamed maintenant",
    #    "telephone à Dr Ben Salah", "appelle STEG sil te plait"...
    m2 = re.search(
        r"(?:appelle|appeler|appele|appellant|telephone|telephoner|tel|appel|call|اتصل|ايطل)"
        r"\s+(?:(?:à|a|au|aux)\s+)?(?:le|la|mon|ma|ton|ta)\s+"
        r"(?P<nom>[a-z\u00e0-\u017f]+(?:\s+[a-z\u00e0-\u017f]+)*)",
        t)
    if m2:
        mots = m2.group("nom").strip().split()
        # Garde les mots nobles/descriptifs, coupe des qu'un parasite apparait
        nom_propre = mots[0].capitalize()
        if mots[0] in mots_stop:
            nom_propre = ""
        for mot in mots[1:]:
            if mot in mots_stop:
                break
            nom_propre += " " + mot.capitalize()
        if nom_propre:
            return nom_propre
    # 3) "dr", "mr", "mme" (titre + nom)
    m3 = re.search(r"\b(?:dr|mr|pr|mme|m\.)\s+([a-z\u00e0-\u017f]+(?:\s+[a-z\u00e0-\u017f]+)?)",
                   t, flags=re.IGNORECASE)
    if m3:
        return m3.group(1).title()
    return "Contact"

def _extraire_heure(text: str) -> str:
    """Recupere une heure type '10h' voire une heure complete 'a 16h'."""
    m = re.search(r"\b(\d{1,2})h(?:\s?(\d{2}))?\b", text)
    if m:
        h = int(m.group(1))
        mi = m.group(2) or "00"
        return f"{h:02d}:{mi}"
    return None

def _extraire_jour(text: str) -> str:
    t = text.lower()
    if "demain" in t or "غدوة" in t or "غدا" in t:
        return (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
    if "apres-demain" in t or "بعد غد" in t:
        return (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d")
    if "aujourd" in t or "lyoum" in t or "اليوم" in t:
        return datetime.now().strftime("%Y-%m-%d")
    m = re.search(r"\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b", text)
    if m:
        j, mois, an = m.group(1), m.group(2), m.group(3) or str(datetime.now().year)
        return f"{int(an):04d}-{int(mois):02d}-{int(j):02d}"
    return datetime.now().strftime("%Y-%m-%d")

def _extraire_texte_message(text: str) -> str:
    """Pour un envoi de message : recupere le contenu apres 'dis-lui'."""
    m = re.search(r"(?:dis-lui|di-lui|dislui|qouli|lou)\s+(.+)$", text)
    if m:
        return m.group(1).strip().capitalize()
    return ""

def analyser(message: str) -> dict:
    """Analyse un message Tunisien et renvoie l'intention + infos.

    Ordre de priorite : les intentions d'ACTION (whatsapp, appel, rdv, email,
    trading, rappel) sont verifiees AVANT les politesses (salutation/merci/
    au-revoir) pour eviter qu'un message du type «whatsapp ... bonjour» ne soit
    classe a tort comme une simple salutation.
    """
    t = _nettoyer_texte(message)
    jour = _extraire_jour(t)
    heure = _extraire_heure(t)
    contact = _extraire_contact(t)

    if _contient(t, ["whatsapp", "msg ", "ارسل", "انبوب", "واتساب", "واتس", "ابعت", "message a"])\
            and not _contient(t, ["lwaqt", "waqt", "chnouwa", "chnawa"]):
        corps = _extraire_texte_message(t)
        return {"intention": "whatsapp", "contact": contact, "jour": jour, "heure": heure, "texte": corps or message}
    if _contient(t, ["appelle ", "appelle-", "appele ", "appel ", "telephone", "tel-moi",
                     "appele-moi", "ايطل", "اتصل", "call", "appeler "])\
            and not _contient(t, ["s'appelle", "s appelle", "sappelle", "ei appel"]):
        # « s'appelle » (presenter quelqu'un) ne doit PAS declencher un appel :
        # on n'accepte que les tournures demandant vraiment d'appeler.
        return {"intention": "call", "contact": contact, "jour": jour, "heure": heure, "texte": message}
    if _contient(t, ["rdv", "rendez", "موعد", "لقاء", "حجز", "prends"]):
        return {"intention": "rdv", "contact": contact, "jour": jour, "heure": heure, "texte": message}
    # Email : on exige signal explicite. "mail"/"email" doivent etre des MOTS
    # entiers (sinon "ismail", "jmail", "smail" declenchaient a tort), et on
    # exclut les mots sans verbe d'action d'email.
    if _est_email(t):
        return {"intention": "email", "contact": contact, "jour": jour, "heure": heure, "texte": message}
    if _est_meteo(t):
        return {"intention": "meteo", "contact": contact, "jour": jour, "heure": heure, "texte": message}
    if _contient(t, ["binance", "invest", "investir", "gagne", "profit", "bitcoin", "b tc",
                     "btc", "crypto", "achete du", "vends ", "شراء", "اشتري", "اشتر", "بيع", "استثمار",
                     "بيتكوين", "سعر", "السعر", "ثمن", "تحليل", "صرف", "كريبتو", "عملة",
                     "cryptomonnaie"]):
        return {"intention": "trading", "contact": None, "jour": jour, "heure": heure, "texte": message}
    if _contient(t, ["rappelle-moi", "rappel", "najm troufassni", "ذكرني", "فكرني", "ذكر", "rappelle le"]):
        return {"intention": "rappel", "contact": contact, "jour": jour, "heure": heure, "texte": message}
    if _contient(t, ["planning", "programme", "agenda", "mon planning", "الجدول", "جدول", "برنامج", "plan du"]):
        return {"intention": "planning", "contact": None, "jour": jour, "heure": heure, "texte": message}
    if _contient(t, ["saha", "bonjour", "salut", "sbah el khir", "hello", "بونجور",
                     "صحه", "صباح الخير", "السلام", "اهلا", "مرحبا"]):
        return {"intention": "salutation", "contact": None, "jour": jour, "heure": heure, "texte": message}
    if _contient(t, ["merci", "chokran", "شكرا"]):
        return {"intention": "merci", "contact": None, "jour": jour, "heure": heure, "texte": message}
    if _contient(t, ["au revoir", "by", "bye", "مع السلامة", "بسلامة", "besslema"]):
        return {"intention": "au_revoir", "contact": None, "jour": jour, "heure": heure, "texte": message}
    return {"intention": "question", "contact": contact, "jour": jour, "heure": heure, "texte": message}


def repondre(intention: dict, nom_assistant: str = "Hmied حميد", mode: str = "simu") -> str:
    """Construit la reponse de l'assistant selon l'intention."""
    it = intention["intention"]
    contact = intention["contact"]
    jour = intention["jour"]
    heure = intention["heure"]
    texte = intention["texte"]

    if it == "salutation":
        return "صحة زيتو! أنا حميد، المساعد تاعك. علاش ما تحكيلش شنوة تحب نعملولك اليوم؟"
    if it == "planning":
        return (f"أهلا! هاك برنامجك نهار {jour} : حاليا ما عندك حتى حاجة مبرمجة. "
                "تحب نكَتبلك موعد؟")
    if it == "rappel":
        h = heure or "16:00"
        c = contact if contact and contact != "Contact" else "الكونطاكت"
        if mode == "simu":
            return f"تويتي. نشكرك نذكرك نهار {jour} على {h} ({c}). (وضع تجريبي : ما بعثتش حتى SMS.)"
        return f"تذكير مبرمج نهار {jour} على {h} لـ {c}."
    if it == "whatsapp":
        c = contact if contact and contact != "Contact" else "الكونطاكت"
        corps = texte if texte and len(texte) > 3 else "رسالة بلا نص."
        if mode == "simu":
            return (f"أوكاي! بعثت رسالة واتساب (تجريبي) إلى {c} : «{corps}» "
                    "(ركّب مزود في config.py : Maytapi أو 360dialog، طويلو محجوب في تونس).")
        return f"بعثت رسالة واتساب إلى {c} : «{corps}»."
    if it == "rdv":
        c = contact if contact and contact != "Contact" else "الكونطاكت"
        h = heure or "10:00"
        if mode == "simu":
            return (f"كتبت الموعد لـ {c} نهار {jour} على {h}. "
                    "(وضع تجريبي : مازلت ما بعثتش دعوة. عطني مفاتيح التقويم/طويلو باش نعملها حقيقة.)")
        return f"صيّرت موعد مع {c} نهار {jour} على {h}. بعثت الدعوة."
    if it == "email":
        if mode == "simu":
            return "حضّرت الإيميل (تجريبي). ركّب SMTP في config.py باش يَبْعَث."
        return "إيميل متبْعوث."
    if it == "trading":
        return "توا نحلل سوق الكريبتو. عفكرة وحدة..."
    if it == "merci":
        return "بلا جميل! واذا تحب حاجة أخرى حكيلّي."
    if it == "au_revoir":
        return "يالله بسلامة! نشوفك قريب."
    if it == "call":
        c = contact if contact and contact != "Contact" else "الكونطاكت"
        return f"نكلمك الآن مع {c}. 📞"
    return (f"فهمت طلبك. ساعدني شوية : تحب موعد، رسالة واتساب، تذكير، ولاّ إيميل؟ "
            "(قول مثلا «اعمل موعد مع خويا غدوة على 10»)")


def executer(message: str, nom_assistant: str, mode: str) -> dict:
    """Pipeline complet : analyse -> reponse."""
    # Apprentissage continu du dialecte de Hamdi (nouveaux mots derja -> derja.json)
    try:
        from assistant import dialecte
        try:
            dialecte.apprendre_depuis_message(message)
        except Exception as _e:
            print("[dialecte] apprentissage erreur:", _e)
        rapide = None
        try:
            rapide = dialecte.phrase_rapide(message)
        except Exception:
            rapide = None
        if rapide:
            return {"intention": "salutation", "reponse": rapide, "infos": {"rapide": True}}
    except Exception:
        pass
    intention = analyser(message)
    reponse = repondre(intention, nom_assistant, mode)
    return {
        "intention": intention["intention"],
        "reponse": reponse,
        "infos": {k: v for k, v in intention.items() if k != "intention"},
    }


if __name__ == "__main__":
    tests = [
        "saha",
        "prends rendez-vous avec mon frere Mohamed demain a 10h",
        "rappelle-moi le medecin a 16h",
        "whatsapp mon frere dis-lui qu'on se voit demain ?",
        "merci",
    ]
    for msg in tests:
        print("->", msg)
        print("   ", executer(msg, "Hmied حميد", "simu"))
        print()
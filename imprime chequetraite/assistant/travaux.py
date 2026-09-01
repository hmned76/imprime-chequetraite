"""
Gestion des "travaux" de Hmied : services/actions (STEG, Sonede, Telecom...).

Hmied peut ajouter des travaux au menu de deux facons :
  1. Depuis la page admin web (POST /api/travaux).
  2. Par la voix/texte : l'utilisateur dit « ajoute STEG au menu » -> on extrait
     le nom et l'URL (eventuellement via l'IA) et on l'ajoute en base.
"""

import re

try:
    from assistant import storage, ia
except ImportError:
    import storage
    import ia

# Quelques sites tunisiens connus par defaut (nom -> URL)
_TRAVAUX_DEFAUT = {
    "steg": "https://www.steg.com.tn",
    "sonede": "https://www.sonede.com.tn",
    "telecom": "https://www.tunisietelecom.tn",
    "elfekih": "https://www.e-fkih.com",
    "binance": "https://www.binance.com",
}


def initialiser_defauts() -> int:
    """Ajoute les travaux connus par defaut s'ils n'existent pas encore."""
    n = 0
    for nom, url in _TRAVAUX_DEFAUT.items():
        try:
            storage.ajouter_travail(nom, url)
            n += 1
        except Exception:
            pass
    return n


def detecter_demande_travail(message: str) -> bool:
    """Detecte si le message demande d'ajouter un travail au menu."""
    t = message.lower().strip()
    words = ["ajoute", "ajout", "mets", "ajoid", "zid", "add", "intégre",
             "integre", "rajoute", "menu", "travail", "travaux",
             "service", "sahb", "aamel"]
    # Il faut un verbe d'ajout ET un indicateur de menu/travaux
    # NB: "met" seul est exclu car il matche "meteo".
    a_verbe = any(k in t for k in ["ajoute", "ajout", "mets", "zid",
                                   "ajoid", "add", "intégre", "integre", "rajoute"])
    a_contexte = any(k in t for k in ["menu", "travail", "travaux", "service",
                                      "liste", "ajouter", "consigne"])
    return a_verbe or (a_contexte and ("menou" in t or "travaux" in t or "travail" in t))


def extraire_url_message(message: str) -> str:
    """Cherche une URL explicite (ou un domaine) donnee par l'utilisateur."""
    t = message.lower()
    # 1) URL complete
    m = re.search(r"https?://[^\s,;]+", t)
    if m:
        return m.group(0).rstrip(".,)!]")
    # 2) mot clef "url ..." / "site ..." / "domaine ..." suivi d'un domaine
    m = re.search(r"(?:url|site|domaine|l'url|len\s+url)\s+[:\s]*([a-z0-9][a-z0-9.\-]+\.[a-z]{2,})", t)
    if m:
        dom = m.group(1).lower()
        if not dom.startswith("http"):
            dom = "https://" + dom
        return dom
    # 3) domaine nu (qqch.tn, qqch.com)
    m = re.search(r"(?<![a-z0-9.])([a-z0-9][a-z0-9\-]+\.(?:com\.tn|tn|com|net|org))", t)
    if m:
        return "https://" + m.group(1).lower()
    return ""


def extraire_nom(message: str) -> str:
    """Essaie d'extraire le nom du travail a partir du message."""
    t = message.lower()
    # Retire les mots qui ne sont pas le nom
    stop = {"ajoute", "ajout", "le", "la", "les", "au", "a", "dans", "mon",
            "mes", "menu", "travaux", "travail", "service", "de", "du", "des",
            "met", "mets", "zid", "existe", "integre", "intégre", "sahb",
            "stp", "svp", "merci", "bech", "nheb", "naaml", "ajoid",
            "nomme", "nommee", "nom", "appele", "appelle", "appel", "url", "site",
            "domaine", "avec", "son", "pour", "ouvrir", "ouvre", "qui", "qu",
            "un", "une", "nouveau", "nouvelle", "nouveaux", "fil", "fi", "harm",
            "leil", "l", "kifech", "bch", "taa", "mta3ou", "mte3i", "hathi",
            "add", "je", "veux", "want", "goul", "goule", "derja", "haba", "nheb",
            "le", "les", "des", "d", "de", "du", "la", "ajouter", "ajoutera"}

    # Si une URL figure, retire la du texte pour ne pas la prendre comme nom
    corpo = re.sub(r"https?://[^\s,;]+", "", t)
    corpo = re.sub(r"[a-z0-9][a-z0-9.\-]+\.[a-z]{2,}", " ", corpo)

    mots = [m for m in re.findall(r"[a-z0-9]+", corpo) if m not in stop]
    if not mots:
        return ""
    nom = " ".join(mots[:2]).strip()
    return nom.capitalize()


def url_pour_nom(nom: str) -> str:
    """Trouve une URL pour un nom de travail, via la base connue ou en devinant."""
    n = nom.lower().strip()
    if n in _TRAVAUX_DEFAUT:
        return _TRAVAUX_DEFAUT[n]
    # Essayer avec l'IA si disponible
    try:
        if ia.est_actif():
            url = ia.trouver_url_travail(nom)
            if url:
                return url
    except Exception:
        pass
    # Fallback : construire un domaine .com.tn ou .com
    slug = re.sub(r"[^a-z0-9]", "", n.lower())
    if slug:
        return "https://" + slug + ".com.tn"
    return ""


def gerer_message(message: str) -> dict:
    """Point d'entree : analyse un message et, si c'est une demande de travail,
    l'ajoute. Retourne un dict avec une reponse ou None si ce n'est pas une demande."""
    if not detecter_demande_travail(message):
        return None
    nom = extraire_nom(message)
    if not nom:
        return {"ajoute": False, "reponse":
            "Kifech? Goul-li chnouwa el travail bch naji nzidhom il menu (ex: « ajoute STEG »)."}
    url = extraire_url_message(message) or url_pour_nom(nom)
    if not url:
        return {"ajoute": False, "reponse":
            f"Ma najemtech nafhem URL taa {nom}. A3tini el site mta3ou (ex: « ajoute {nom}, sited.com »)."}
    storage.ajouter_travail(nom, url)
    liste = ", ".join(t["nom"] for t in storage.lister_travaux())
    return {"ajoute": True, "nom": nom, "url": url, "travaux": liste,
            "reponse": (f"Behi! Zidthe {nom} fil menu (site: {url}). "
                        f"Tawwa el travaux mawjoudin: {liste}.")}

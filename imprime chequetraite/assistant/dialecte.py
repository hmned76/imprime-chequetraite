"""
Moteur de dialecte tunisien (derja) pour Hmied.

Deux niveaux :
  1. RAPIDE (local, instantane, sans IA) : si le message de Hamdi contient un
     mot/expression connu du dictionnaire dialectes/derja.json, on repond tout
     de suite avec la phrase prete correspondante (ou on donne le sens).
  2. APPRENTISSAGE AUTO : chaque mot derja non encore connu est extrait du
     message et ajoute automatiquement au fichier derja.json (section "appris").

Le contenu du dictionnaire est aussi injecte dans le prompt systeme (voir
ia.py) pour que Hmied parle TOUJOURS avec les mots de Hamdi, que le cerveau
soit Ollama ou OpenRouter.
"""

import json
import os
import re
import threading

DOSSIER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "dialectes")
FICHIER = os.path.join(DOSSIER, "derja.json")

_lock = threading.Lock()
_cache = None  # dict decodé, relu si le fichier change
_cache_mtime = 0.0


def _charger() -> dict:
    global _cache, _cache_mtime
    try:
        mtime = os.path.getmtime(FICHIER)
    except Exception:
        mtime = 0.0
    # Recharge uniquement si le fichier a change sur disque (édition manuelle)
    if _cache is None or mtime != _cache_mtime:
        try:
            with open(FICHIER, "r", encoding="utf-8") as f:
                _cache = json.load(f)
            _cache_mtime = mtime
        except Exception:
            _cache = {"mots": {}, "phrases_reponses": {}, "appris": {}}
            _cache_mtime = mtime
    _cache.setdefault("mots", {})
    _cache.setdefault("phrases_reponses", {})
    _cache.setdefault("appris", {})
    return _cache


def _sauver() -> None:
    global _cache_mtime
    with _lock:
        with open(FICHIER, "w", encoding="utf-8") as f:
            json.dump(_cache, f, ensure_ascii=False, indent=2)
        try:
            _cache_mtime = os.path.getmtime(FICHIER)
        except Exception:
            pass


def dictionnaire() -> dict:
    _charger()
    return _cache


def _normaliser(texte: str) -> str:
    return re.sub(r"[\s\.\,\:\;\!\?\\\/\(\)]+", " ", (texte or "").strip())


def phrase_rapide(message: str) -> str:
    """Si le message correspond a une salutation/expression connue, renvoie
    immediatement la reponse prete (zéro IA). Sinon None."""
    if not message:
        return None
    d = _charger()
    m = _normaliser(message).lower()
    phrases = d.get("phrases_reponses", {})
    for cle, rep in phrases.items():
        cle_n = _normaliser(cle).lower()
        if cle_n and (cle_n == m or cle_n in m):
            return rep
    return None


def mot_connu(message: str) -> str:
    """Rappelle le sens (en français) d'un mot derja present dans le message."""
    d = _charger()
    m = _normaliser(message).strip()
    tous = {**d.get("mots", {}), **d.get("appris", {})}
    # Recherche le mot le plus long d'abord (expressions > mots seuls)
    for mot in sorted(tous, key=len, reverse=True):
        if mot in m:
            return mot, tous[mot]
    return None, None


def apprendre_depuis_message(message: str) -> int:
    """Extrait les mots derja non encore connus et les ajoute dans la section
    'appris' de derja.json. Sens : traduction française courte devinée a partir
    du dictionnaire existant, sinon le mot sans sens."""

    def extraire_mots(m):
        # Mots arabes (lettres arabes) d'au moins 2 lettres
        return set(re.findall(r"[\u0600-\u06FF]{2,}", m))

    def traduire(mot):
        # Cherche le sens d'une base connue du dictionnaire
        for base, sens in _charger().get("mots", {}).items():
            if mot == base or mot.startswith(base[:3]):
                return sens
        return None

    avec = _charger()
    nouveaux = 0
    for mot in extraire_mots(message):
        if mot in avec.get("mots", {}) or mot in avec.get("appris", {}):
            continue
        sens = traduire(mot) or ""
        avec["appris"][mot] = sens if sens else ""
        nouveaux += 1
    if nouveaux:
        _sauver()
    return nouveaux


def texte_pour_prompt() -> str:
    """Rend le dictionnaire sous forme lisible a injecter dans le prompt systeme."""
    d = _charger()
    tous = {**d.get("mots", {}), **d.get("appris", {})}
    if not tous:
        return ""
    lignes = []
    for mot, sens in sorted(tous.items(), key=lambda kv: -len(kv[0])):
        if sens:
            lignes.append(f"{mot} = {sens}")
    prefixe = "Mots de la dialecte tunisienne DE TON MAITRE Hamdi, utilise-les naturellement: "
    if not lignes:
        return prefixe + " ; ".join(list(d.get("mots", {}).keys()))
    return prefixe + " ; ".join(lignes) + "."


if __name__ == "__main__":
    print("Rapide:", phrase_rapide("صحة زيتو"))
    print("Connu:", mot_connu("كيفاش نعاونك"))
    n = apprendre_depuis_message("الله يعطيك الصحة يا خويا")
    print("Appris:", n, "new ->", list(_charger().get("appris", {}).keys()))
"""
Script léger : given a Tunisian sentence, extract the contact name,
the action (here WhatsApp) and the message body.
The actual DB lookup and Twilio call are left to the backend.
"""

import re
from typing import Dict, Optional


def extract_intent(text: str) -> Dict[str, Optional[str]]:
    """
    Returns a dict with keys:
        - contact_name: the last word assumed to be a person's name
        - action: always "whatsapp" if the sentence contains trigger words
        - message: the part after "à" (if any), otherwise None
        - date_heure: optional part that looks like a date/time

    This is a very naive parser; improve with NLP or a proper intent model.
    """
    # Normaliser un peu (enlever accents optionnels)
    txt = text.lower()

    # Détecter si c'est une demande WhatsApp
    trigger_words = ["prends", "rdv", "msg", "whatsapp", "envoie", "appelle"]
    action = "whatsapp" if any(w in txt for w in trigger_words) else "none"

    # Extraire un nom supposé être celui du contact (dernier mot alphabétique)
    m = re.search(r"([a-zàâäéèêëïîôöùüÿç]+)$", txt)
    contact_name: Optional[str] = m.group(1) if m else None

    # Extraire le message après "à"
    msg_match = re.search(r"à\s+(.+)$", txt)
    message: Optional[str] = msg_match.group(1).strip() if msg_match else None

    # Extraire une date/heure simple (optionnel)
    date_match = re.search(r"(\d{1,2}[\s/]\d{1,2}[\s/]\d{4}|\d{1,2}:\d{2})", txt)
    date_heure: Optional[str] = date_match.group(1) if date_match else None

    return {
        "contact_name": contact_name,
        "action": action,
        "message": message,
        "date_heure": date_heure,
    }


# Exemple d'utilisation rapide (à supprimer ou garder en mode debug)
if __name__ == "__main__":
    tests = [
        "prends rendez‑vous avec mon frère Mohamed demain à 10h",
        "envoie un msg à mon frère dis‑lui on se voit demain",
        "rappelle le médecin à 16h",
        "montre mon planning de demain",
    ]
    for t in tests:
        print(t, "=>", extract_intent(t))
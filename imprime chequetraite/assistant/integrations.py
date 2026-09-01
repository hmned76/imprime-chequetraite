"""
Integrations externes d'AssistantAI : WhatsApp (Twilio), Email (SMTP).

En mode "simu", ces fonctions journalisent simplement l'action au lieu
d'envoyer. En mode "reel", elles utilisent les cles de config.py.
"""

import requests
import smtplib
from email.message import EmailMessage
import config


def envoyer_whatsapp(destinataire: str, message: str) -> dict:
    """Envoie un message WhatsApp via Twilio (si config), sinon simule."""
    if config.MODE != "reel" or not config.TWILIO_ACCOUNT_SID:
        return {"statut": "simu", "a": destinataire, "contenu": message}

    url = (
        f"https://api.twilio.com/2010-04-01/Accounts/"
        f"{config.TWILIO_ACCOUNT_SID}/Messages.json"
    )
    resp = requests.post(
        url,
        auth=(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN),
        data={
            "From": config.TWILIO_FROM_WHATSAPP,
            "To": f"whatsapp:{destinataire}",
            "Body": message,
        },
        timeout=15,
    )
    if resp.status_code in (200, 201):
        return {"statut": "envoye", "a": destinataire, "sid": resp.json().get("sid")}
    return {"statut": "erreur", "details": resp.text}


def envoyer_email(sujet: str, corps: str) -> dict:
    """Envoie un email via SMTP (si config), sinon simule."""
    if config.MODE != "reel" or not config.SMTP_HOST or not config.EMAIL_ACTIF:
        return {"statut": "simu", "sujet": sujet, "corps": corps}

    msg = EmailMessage()
    msg["Subject"] = sujet
    msg["From"] = config.EMAIL_EXPEDITEUR
    msg["To"] = config.EMAIL_DESTINATAIRE
    msg.set_content(corps)

    with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT) as smtp:
        smtp.starttls()
        smtp.login(config.SMTP_USER, config.SMTP_PASSWORD)
        smtp.send_message(msg)
    return {"statut": "envoye"}
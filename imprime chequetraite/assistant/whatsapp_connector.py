"""
Connecteur WhatsApp pour AssistantAI.

Gere :
- Webhook entrant : reception de messages WhatsApp envoyes au serveur
- Envoi de messages WhatsApp via Twilio ou API cloud alternative
- Polling/monitoring des nouveaux messages WhatsApp
- Integration avec le moteur IA pour repondre automatiquement

Config requis dans config.py pour le mode reel :
- WA_API_PROVIDER : "twilio" | "maytapi" | "360dialog" | "green-api" | "simu"
- WA_WEBHOOK_SECRET : secret pour verifier les webhooks entrants
- WA_RECEIVE_PHONE : numero WhatsApp qui recoit les messages (ex: "+216XXXXXXXX")
- WA_SEND_PHONE : numero WhatsApp qui envoie les messages
- Pour Twilio : TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_WHATSAPP
- Pour Maytapi : WA_MAYTAPI_API_KEY, WA_MAYTAPI_INSTANCE_ID
- Pour 360dialog : WA_360DIALOG_API_KEY, WA_360DIALOG_INSTANCE_ID
- Pour Green-api : GREEN_API_INSTANCE_ID, GREEN_API_API_KEY (https://green-api.com)
"""

import os
import requests
import hmac
import hashlib
import json
import time
import threading
from datetime import datetime

import config


WA_POLL_INTERVAL = 15  # secondes entre chaque polling


def _get_provider() -> str:
    return getattr(config, "WA_API_PROVIDER", "twilio")


def _get_webhook_secret() -> str:
    return getattr(config, "WA_WEBHOOK_SECRET", "")


def _get_receive_phone() -> str:
    return getattr(config, "WA_RECEIVE_PHONE", config.TWILIO_TO_WHATSAPP or "")


def _get_send_phone() -> str:
    return getattr(config, "WA_SEND_PHONE", config.TWILIO_FROM_WHATSAPP or "")


def envoyer_whatsapp(destinataire: str, message: str) -> dict:
    """Envoie un message WhatsApp selon le fournisseur configure."""
    provider = _get_provider()
    if provider == "simu" or not destinataire:
        return {"statut": "simu", "a": destinataire, "contenu": message}
    if provider == "twilio":
        return _envoyer_twilio(destinataire, message)
    if provider == "maytapi":
        return _envoyer_maytapi(destinataire, message)
    if provider == "360dialog":
        return _envoyer_360dialog(destinataire, message)
    if provider == "green-api":
        return _envoyer_greenapi(destinataire, message)
    return {"statut": "erreur", "details": f"Fournisseur WhatsApp inconnu: {provider}"}


def _envoyer_twilio(destinataire: str, message: str) -> dict:
    """Envoie via Twilio WhatsApp API."""
    if not config.TWILIO_ACCOUNT_SID or not config.TWILIO_AUTH_TOKEN:
        return {"statut": "simu", "a": destinataire, "contenu": message}
    url = (
        f"https://api.twilio.com/2010-04-01/Accounts/"
        f"{config.TWILIO_ACCOUNT_SID}/Messages.json"
    )
    resp = requests.post(
        url,
        auth=(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN),
        data={
            "From": config.TWILIO_FROM_WHATSAPP or config.TWILIO_TO_WHATSAPP,
            "To": f"whatsapp:{destinataire}",
            "Body": message,
        },
        timeout=15,
    )
    if resp.status_code in (200, 201):
        return {"statut": "envoye", "a": destinataire, "sid": resp.json().get("sid")}
    return {"statut": "erreur", "details": resp.text}


def _envoyer_maytapi(destinataire: str, message: str) -> dict:
    """Envoie via Maytapi WhatsApp API (format actuel /api/{product}/{phone}/sendMessage)."""
    api_key = getattr(config, "WA_MAYTAPI_API_KEY", "")
    product_id = getattr(config, "WA_MAYTAPI_PRODUCT_ID", "")
    instance_id = getattr(config, "WA_MAYTAPI_INSTANCE_ID", "")  # Phone ID du numero
    if not api_key or not product_id or not instance_id:
        return {"statut": "simu", "a": destinataire, "contenu": message}
    # to_number : indicatif pays + numero, sans caracteres speciaux (ex: 21650...)
    to_number = "".join(ch for ch in destinataire if ch.isdigit())
    url = f"https://api.maytapi.com/api/{product_id}/{instance_id}/sendMessage"
    resp = requests.post(
        url,
        json={"to_number": to_number, "type": "text", "message": message},
        headers={"Content-Type": "application/json", "x-maytapi-key": api_key},
        timeout=15,
    )
    try:
        data = resp.json()
    except Exception:
        data = {}
    if resp.status_code == 200 and data.get("success"):
        mid = (data.get("data") or {}).get("msg_id", "") or (data.get("data") or {}).get("chat_id", "")
        return {"statut": "envoye", "a": destinataire, "id": mid}
    return {"statut": "erreur", "details": resp.text}


def _envoyer_360dialog(destinataire: str, message: str) -> dict:
    """Envoie via 360dialog WhatsApp API."""
    api_key = getattr(config, "WA_360DIALOG_API_KEY", "")
    instance_id = getattr(config, "WA_360DIALOG_INSTANCE_ID", "")
    if not api_key or not instance_id:
        return {"statut": "simu", "a": destinataire, "contenu": message}
    url = f"https://api.360dialog.io/whatsapp/{instance_id}/messages"
    resp = requests.post(
        url,
        json={"to": destinataire, "text": {"body": message}},
        headers={"Authorization": f"Bearer {api_key}"},
        timeout=15,
    )
    if resp.status_code == 200:
        return {"statut": "envoye", "a": destinataire}
    return {"statut": "erreur", "details": resp.text}


def _envoyer_greenapi(destinataire: str, message: str) -> dict:
    """Envoie via Green-api WhatsApp API."""
    instance_id = getattr(config, "GREEN_API_INSTANCE_ID", "")
    api_key = getattr(config, "GREEN_API_API_KEY", "")
    if not instance_id or not api_key:
        return {"statut": "simu", "a": destinataire, "contenu": message}
    url = f"https://api.green-api.com/waSender/{instance_id}/sendMessage"
    resp = requests.post(
        url,
        json={
            "chatId": f"{destinataire}@c.us",
            "message": message,
        },
        headers={"Content-Type": "application/json", "Authorization": api_key},
        timeout=15,
    )
    if resp.status_code == 200:
        return {"statut": "envoye", "a": destinataire, "id": resp.json().get("idMessage")}
    return {"statut": "erreur", "details": resp.text}


def verifier_signature_webhook(payload: bytes, signature: str) -> bool:
    """Verifie la signature du webhook entrant (HMAC-SHA256).

    Supporte le format Meta/WhatsApp Cloud ('sha256=<hex>') ainsi que le hex brut.
    Les fournisseurs sans signature (Maytapi, 360dialog, Green-api) sont acceptes.
    """
    if _get_provider() != "twilio":
        return True
    secret = _get_webhook_secret()
    if not secret:
        return True
    expected = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    # Meta envoie 'sha256=<hex>' ; on compare sans le prefixe si present
    if signature.startswith("sha256="):
        signature = signature[len("sha256="):]
    return hmac.compare_digest(expected, signature)


def _lire_url_publique() -> str:
    """Lit l'URL publique courante (fichier url_actuelle.txt a cote de config.py)."""
    try:
        chemin = os.path.join(os.path.dirname(os.path.abspath(config.__file__)), "url_actuelle.txt")
        if os.path.exists(chemin):
            url = open(chemin, encoding="utf-8").read().strip()
            if url.startswith("http"):
                return url
    except Exception as e:
        print("Lecture url_actuelle.txt:", e)
    return ""


def enregistrer_webhook() -> dict:
    """Enregistre/re-enregistre le webhook WhatsApp chez le fournisseur actif."""
    provider = _get_provider()
    if provider == "maytapi":
        return _enregistrer_webhook_maytapi()
    return {"statut": "aucun", "fournisseur": provider}


def _enregistrer_webhook_maytapi() -> dict:
    api_key = getattr(config, "WA_MAYTAPI_API_KEY", "")
    product_id = getattr(config, "WA_MAYTAPI_PRODUCT_ID", "")
    if not api_key or not product_id:
        return {"statut": "cle_manquante"}
    url_publique = _lire_url_publique()
    if not url_publique:
        return {"statut": "url_manquante"}
    webhook_url = url_publique.rstrip("/") + "/api/whatsapp/webhook"
    url = f"https://api.maytapi.com/api/{product_id}/setWebhook"
    resp = requests.post(
        url,
        json={"webhook": webhook_url},
        headers={"Content-Type": "application/json", "x-maytapi-key": api_key},
        timeout=15,
    )
    if resp.status_code == 200:
        return {"statut": "webhook_enregistre", "webhook": webhook_url}
    return {"statut": "erreur", "details": resp.text}


def traiter_message_whatsapp(data: dict) -> dict:
    """Traite un message WhatsApp entrant et genere une reponse IA."""
    from assistant import engine, ia, storage

    # Normalisation selon le fournisseur
    if data.get("type") == "message" and "user" in data and "conversation" in data:
        msg = data.get("message") or {}
        if msg.get("fromMe"):
            return {"statut": "ignore", "details": "message sortant"}
        numero_expediteur = (data.get("user") or {}).get("phone") or ""
        if not numero_expediteur:
            numero_expediteur = (data.get("user") or {}).get("id", "")
        message_texte = msg.get("text") or msg.get("message") or ""
        message_id = msg.get("id", "")
        timestamp = str(data.get("timestamp", ""))
    else:
        numero_expediteur = data.get("from", "")
        message_texte = data.get("body", data.get("text", ""))
        message_id = data.get("id", "")
        timestamp = data.get("timestamp", "")

    if not message_texte or not numero_expediteur:
        return {"statut": "erreur", "details": "Message vide ou expediteur inconnu"}

    # Enregistrer le message recu
    storage.ajouter_conversation(
        "user", message_texte, "whatsapp",
        meta={"numero": numero_expediteur, "message_id": message_id}
    )

    # Traiter avec le moteur IA
    resultat = engine.executer(message_texte, config.NOM_ASSISTANT, config.MODE)
    reponse = resultat["reponse"]
    intention = resultat["intention"]
    actions = resultat.get("actions", [])

    # Si c'est une question libre, utiliser Ollama/OpenRouter
    if intention == "question" and ia.est_actif():
        try:
            llm = ia.generer(message_texte)
            if llm:
                reponse = llm
        except Exception as e:
            print("Ollama erreur:", e)

    # Envoyer la reponse WhatsApp
    res_envoi = envoyer_whatsapp(numero_expediteur, reponse)

    # Persister la conversation
    storage.ajouter_conversation("assistant", reponse, intention,
                                  meta={"numero": numero_expediteur, "wa_action": res_envoi.get("statut")})

    return {
        "statut": "ok",
        "de": numero_expediteur,
        "message": message_texte,
        "reponse": reponse,
        "intention": intention,
        "wa_envoi": res_envoi,
        "actions": actions,
    }


class WhatsAppMonitor:
    """Monitoring des nouveaux messages WhatsApp (polling)."""

    def __init__(self):
        self._actif = False
        self._thread = None
        self._callback = None

    def demarrer(self, callback=None):
        """Demarre le monitoring en arrière-plan."""
        if self._actif:
            return
        self._actif = True
        self._callback = callback
        self._thread = threading.Thread(target=self._boucle, daemon=True)
        self._thread.start()
        print("WhatsAppMonitor demarre (polling toutes", WA_POLL_INTERVAL, "s)")

    def arreter(self):
        """Arrete le monitoring."""
        self._actif = False
        if self._thread:
            self._thread.join(timeout=5)
            self._thread = None
        print("WhatsAppMonitor arrete")

    @property
    def actif(self) -> bool:
        return self._actif

    def _boucle(self):
        dernier_traitement = 0
        while self._actif:
            try:
                messages = self._poller_messages(dernier_traitement)
                for msg in messages:
                    dernier_traitement = max(dernier_traitement, msg.get("timestamp", 0))
                    try:
                        if self._callback:
                            self._callback(msg)
                        traiter_message_whatsapp(msg)
                    except Exception as e:
                        print("WA traitement erreur:", e)
            except Exception as e:
                print("WA polling erreur:", e)
            time.sleep(WA_POLL_INTERVAL)

    def _poller_messages(self, since_timestamp: int) -> list:
        """Polling des nouveaux messages depuis le dernier timestamp.

        Implemente selon le fournisseur (Twilio, Maytapi, etc.).
        Retourne une liste de dicts : [{"from": "...", "body": "...", "timestamp": 12345}]
        """
        provider = _get_provider()
        if provider == "twilio":
            return self._poller_twilio(since_timestamp)
        if provider == "maytapi":
            return self._poller_maytapi(since_timestamp)
        if provider == "360dialog":
            return self._poller_360dialog(since_timestamp)
        if provider == "green-api":
            return self._poller_greenapi(since_timestamp)
        return []

    def _poller_twilio(self, since_timestamp: int) -> list:
        messages = []
        if not config.TWILIO_ACCOUNT_SID or not config.TWILIO_AUTH_TOKEN:
            return messages
        try:
            url = (
                f"https://api.twilio.com/2010-04-01/Accounts/"
                f"{config.TWILIO_ACCOUNT_SID}/Messages.json"
            )
            resp = requests.get(
                url,
                auth=(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN),
                params={"To": f"whatsapp:{_get_receive_phone()}"},
                timeout=10,
            )
            if resp.status_code == 200:
                data = resp.json()
                for msg in data.get("messages", []):
                    ts = int(msg.get("date_sent", 0))
                    if ts > since_timestamp and msg.get("num_media", 0) == 0:
                        messages.append({
                            "from": msg.get("from", "").replace("whatsapp:", ""),
                            "body": msg.get("body", ""),
                            "timestamp": ts,
                            "message_id": msg.get("sid", ""),
                        })
        except Exception as e:
            print("WA Twilio polling erreur:", e)
        return messages

    def _poller_maytapi(self, since_timestamp: int) -> list:
        # Maytapi delivre les messages entrants par WEBHOOK (setWebhook),
        # pas de polling de toutes les conversations ici.
        return []

    def _poller_360dialog(self, since_timestamp: int) -> list:
        messages = []
        api_key = getattr(config, "WA_360DIALOG_API_KEY", "")
        instance_id = getattr(config, "WA_360DIALOG_INSTANCE_ID", "")
        if not api_key or not instance_id:
            return messages
        try:
            url = f"https://api.360dialog.io/whatsapp/{instance_id}/messages"
            resp = requests.get(
                url,
                headers={"Authorization": f"Bearer {api_key}"},
                params={"limit": 50},
                timeout=10,
            )
            if resp.status_code == 200:
                data = resp.json()
                for msg in data.get("messages", []):
                    ts = int(msg.get("timestamp", 0))
                    if ts > since_timestamp:
                        messages.append({
                            "from": msg.get("from", ""),
                            "body": msg.get("body", ""),
                            "timestamp": ts,
                            "message_id": msg.get("id", ""),
                        })
        except Exception as e:
            print("WA 360dialog polling erreur:", e)
        return messages

    def _poller_greenapi(self, since_timestamp: int) -> list:
        messages = []
        instance_id = getattr(config, "GREEN_API_INSTANCE_ID", "")
        api_key = getattr(config, "GREEN_API_API_KEY", "")
        if not instance_id or not api_key:
            return messages
        try:
            url = f"https://api.green-api.com/waqs/{instance_id}/lastMessages"
            resp = requests.get(
                url, headers={"Content-Type": "application/json"},
                params={"limit": 50}, timeout=10,
            )
            if resp.status_code == 200:
                data = resp.json()
                for msg in data.get("messages", []):
                    ts = int(msg.get("timestamp", 0))
                    if ts > since_timestamp:
                        messages.append({
                            "from": msg.get("senderId", ""),
                            "body": msg.get("messageData", {}).get("textMessageData", {}).get("textMessage", ""),
                            "timestamp": ts,
                            "message_id": msg.get("idMessage", ""),
                        })
        except Exception as e:
            print("WA Green-api polling erreur:", e)
        return messages


# Instance globale du monitor
_wa_monitor = WhatsAppMonitor()


def demarrer_whatsapp_monitor(callback=None):
    """Demarre le monitoring des messages WhatsApp."""
    _wa_monitor.demarrer(callback)


def arreter_whatsapp_monitor():
    """Arrete le monitoring des messages WhatsApp."""
    _wa_monitor.arreter()


def get_wa_monitor():
    """Retourne l'instance du monitor."""
    return _wa_monitor
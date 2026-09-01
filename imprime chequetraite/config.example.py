"""
Configuration d'AssistantAI.

Remplis tes cles API pour passer du mode simu au mode reel.
Le serveur reste fonctionnel meme sans elles (mode "simu" / "paper-trading").
"""

# --- Mode de marche ---
# "simu" : aucune cle requise, les actions externes sont simulees
# "reel" : les integrations actives sont utilisees (cle presente = active)
#          Si une cle manque, l'action est signalee comme "cle manquante" (pas d'envoi reel).
MODE = "reel"

# --- Serveur ---
HOST = "0.0.0.0"          # accessible depuis l'exterieur (5G) via le tunnel
PORT = 5000
NOM_ASSISTANT = "Hmied حميد"
PREFIXE_UTILISATEUR = "Toi"

# --- Cerveau IA (OpenRouter / Ollama) ---
# OpenRouter : UNE seule cle API pour tous les modeles (Claude, GPT, Gemini, Llama,
# DeepSeek...). Modeles GRATUITS disponibles (suffixe ":free", ex ci-dessous).
# Inscription : https://openrouter.ai  ->  cle "sk-or-..."
# Colle ta cle ici ; laisse vide pour utiliser Ollama local.
OPENROUTER_API_KEY = ""
OPENROUTER_MODEL = "meta-llama/llama-3.3-70b-instruct:free"
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

# --- WhatsApp (Twilio) ---
# Pour tester l'envoi reel, colle ici tes cles de la console Twilio.
TWILIO_ACCOUNT_SID = ""
TWILIO_AUTH_TOKEN = ""
TWILIO_FROM_WHATSAPP = ""        # ex: "whatsapp:+14155238886" (numéro sandbox Twilio)
TWILIO_TO_WHATSAPP = ""          # ex: "whatsapp:+216XXXXXXXX" (ton numéro)

# --- Email (SMTP / SendGrid) ---
EMAIL_ACTIF = False              # passe a True quand tu as rempli le serveur SMTP
SMTP_HOST = ""
SMTP_PORT = 587
SMTP_USER = ""
SMTP_PASSWORD = ""
EMAIL_EXPEDITEUR = ""
EMAIL_DESTINATAIRE = ""

# --- Calendrier (Google) ---
GOOGLE_CLIENT_SECRET_FILE = ""

# --- Binance (investissement / trading) ---
# PAPER = True : trading SIMULE avec argent fictif (recommandé pour tester)
# PAPER = False : ordres REELS (risque de perte d'argent !)
# Ne met JAMAIS tes vraies clés si tu ne comprends pas les risques.
BINANCE_PAPER = True
BINANCE_API_KEY = ""
BINANCE_SECRET = ""
BINANCE_COIN_DE_BASE = "BTCUSDT"
BINANCE_CAPITAL_INITIAL = float(100)   # en USDT (fictionnel en mode paper)

# --- Contacts (numeros de telephone pour les appels) ---
# Ajoute tes contacts ici avec leur numero.
CONTACTS = {
    "frere": "+216XXXXXXXX",
    "mohamed": "+216XXXXXXXX",
}

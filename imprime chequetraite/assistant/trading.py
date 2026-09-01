"""
Module trading Binance pour AssistantAI.

- Lit les prix en public (aucune cle requise).
- Analyse la tendance (RSI + SMA) pour SUGGERER un mouvement.
- Paper-trading par defaut (argent fictif) : utilise les clefs uniquement si
  BINANCE_PAPER=False (dangereux : on peut perdre de l'argent reel).

AVERTISSEMENT : aucun robot ne garantit de gains. Ce module est un outil de
demonstration ; l'investissement comporte toujours des risques.
"""

import hashlib
import hmac
import json
import os
import time
from datetime import datetime

import requests

import config

API_BASE = "https://api.binance.com"
PORTEFEUILLE_FILE = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "db", "portfolio.json"
)

SYMBOLES_COMMUNS = {
    "btc": "BTCUSDT", "bitcoin": "BTCUSDT",
    "eth": "ETHUSDT", "ether": "ETHUSDT",
    "sol": "SOLUSDT", "solana": "SOLUSDT",
    "xrp": "XRPUSDT", "ada": "ADAUSDT",
    "bnb": "BNBUSDT", "doge": "DOGEUSDT",
}


# ---------- API publique Binance ----------

def obtenir_prix(symbole: str = "BTCUSDT") -> float:
    r = requests.get(f"{API_BASE}/api/v3/ticker/price", params={"symbol": symbole}, timeout=15)
    r.raise_for_status()
    return float(r.json()["price"])


def _klines(symbole: str, intervalle: str = "1d", limite: int = 20) -> list:
    r = requests.get(
        f"{API_BASE}/api/v3/klines",
        params={"symbol": symbole, "interval": intervalle, "limit": limite},
        timeout=15,
    )
    r.raise_for_status()
    return [float(k[4]) for k in r.json()]  # clôtures


def _rsi(clotures: list, periode: int = 14) -> float:
    if len(clotures) <= periode:
        return 50.0
    gains, pertes = [], []
    for i in range(1, len(clotures)):
        diff = clotures[i] - clotures[i - 1]
        gains.append(max(diff, 0))
        pertes.append(max(-diff, 0))
    mg = sum(gains[-periode:]) / periode
    mp = sum(pertes[-periode:]) / periode
    if mp == 0:
        return 100.0
    rs = mg / mp
    return 100 - (100 / (1 + rs))


def _sma(clotures: list, periode: int) -> float:
    return sum(clotures[-periode:]) / min(periode, len(clotures))


def analyser_marche(symbole: str = "BTCUSDT") -> dict:
    """Analyse la tendance et renvoie un signal conservateur."""
    clotures = _klines(symbole)
    prix = clotures[-1]
    rsi = _rsi(clotures)
    sma10 = _sma(clotures, 10)
    sma20 = _sma(clotures, 20)

    if rsi >= 70:
        signal = "VENTE_PRUDE_CHE"   # surchauffe
        texte = "Le marche est surchauffe (RSI haut) : prudence, on ne rachète pas en haut."
        action = "attendre"
    elif rsi <= 30:
        signal = "ACHAT_CONTRE_TENDANCE"
        texte = "Le marche semble survendu (RSI bas). Petit echantillon possible, risque eleve."
        action = "acheter_idealement" if prix >= sma20 else "attendre"
    elif prix > sma10 > sma20:
        signal = "TENDANCE_HAUSSIERE"
        texte = "Tendance haussiere : le prix est au-dessus des moyennes."
        action = "achat_modere"
    elif prix < sma10 < sma20:
        signal = "TENDANCE_BAISSIERE"
        texte = "Tendance baissiere : le prix est sous les moyennes. On n'achète pas."
        action = "attendre"
    else:
        signal = "NEUTRE"
        texte = "Marche neutre : sans signal clair, on attend."
        action = "attendre"

    return {
        "symbole": symbole,
        "prix": round(prix, 2),
        "rsi": round(rsi, 1),
        "sma10": round(sma10, 2),
        "sma20": round(sma20, 2),
        "signal": signal,
        "action": action,
        "texte": texte,
        "a": datetime.now().strftime("%Y-%m-%d %H:%M"),
    }


def extraire_symbole(message: str) -> str:
    msg = message.lower()
    for key, sym in SYMBOLES_COMMUNS.items():
        if key in msg:
            return sym
    return config.BINANCE_COIN_DE_BASE


# ---------- Portefeuille (paper-trading) ----------

def _charger_portefeuille() -> dict:
    if os.path.exists(PORTEFEUILLE_FILE):
        with open(PORTEFEUILLE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"usdt": config.BINANCE_CAPITAL_INITIAL, "positions": {}, "trades": []}


def _sauver_portefeuille(pf: dict):
    os.makedirs(os.path.dirname(PORTEFEUILLE_FILE), exist_ok=True)
    with open(PORTEFEUILLE_FILE, "w", encoding="utf-8") as f:
        json.dump(pf, f, ensure_ascii=False, indent=2)


def valeur_portefeuille() -> dict:
    pf = _charger_portefeuille()
    total = pf["usdt"]
    positions = {}
    for sym, qte in pf["positions"].items():
        try:
            prix = obtenir_prix(sym)
            val = qte * prix
            total += val
            positions[sym] = {"quantite": qte, "prix": prix, "valeur": round(val, 2)}
        except Exception:
            positions[sym] = {"quantite": qte, "prix": "?", "valeur": "?"}
    return {
        "usdt": round(pf["usdt"], 2),
        "positions": positions,
        "total": round(total, 2),
        "n_trades": len(pf["trades"]),
    }


def trader_paper(symbole: str, cote: str, montant_usdt: float) -> dict:
    """Achete/vend en mode simulation (argent fictif)."""
    pf = _charger_portefeuille()
    prix = obtenir_prix(symbole)
    cote = cote.upper()

    if cote == "ACHAT":
        if montant_usdt > pf["usdt"]:
            return {"ok": False, "raison": f"Solde insuffisant : {pf['usdt']:.2f} USDT"}
        qte = montant_usdt / prix
        pf["usdt"] -= montant_usdt
        pf["positions"][symbole] = pf["positions"].get(symbole, 0) + qte
        operateur = "achete"
    elif cote == "VENTE":
        if symbole not in pf["positions"] or pf["positions"][symbole] <= 0:
            return {"ok": False, "raison": f"Tu ne possèdes pas {symbole}"}
        qte = pf["positions"][symbole]
        pf["usdt"] += qte * prix
        del pf["positions"][symbole]
        operateur = "vendu"
    else:
        return {"ok": False, "raison": "cote invalide (ACHAT/VENTE)"}

    pf["trades"].append({
        "time": datetime.now().isoformat(),
        "cote": cote,
        "symbole": symbole,
        "prix": prix,
        "montant_usdt": round(montant_usdt, 2),
    })
    _sauver_portefeuille(pf)
    return {"ok": True, "action": operateur, "symbole": symbole,
            "quantite": round(qte, 8), "prix": prix, "portefeuille": valeur_portefeuille()}


def _signer_requete(params: dict) -> dict:
    query = "&".join(f"{k}={v}" for k, v in params.items())
    signature = hmac.new(config.BINANCE_SECRET.encode(), query.encode(), hashlib.sha256).hexdigest()
    params["signature"] = signature
    return params


def ordre_reel(symbole: str, cote: str, quantite: float) -> dict:
    """Ordre REEL sur Binance spot (attention : argent reel)."""
    if not config.BINANCE_API_KEY or not config.BINANCE_SECRET:
        return {"ok": False, "raison": "Clés Binance manquantes dans config.py"}
    params = _signer_requete({
        "symbol": symbole,
        "side": cote.upper(),
        "type": "MARKET",
        "quantity": str(quantite),
        "timestamp": int(time.time() * 1000),
        "recvWindow": 60000,
    })
    r = requests.post(
        f"{API_BASE}/api/v3/order",
        headers={"X-MBX-APIKEY": config.BINANCE_API_KEY},
        data=params,
        timeout=20,
    )
    if r.status_code in (200, 201):
        return {"ok": True, "reponse": r.json()}
    return {"ok": False, "raison": r.text}


def executer_investissement(message: str) -> dict:
    """Analyse le message d'investissement et renvoie une reponse + action."""
    symbole = extraire_symbole(message)
    analyse = analyser_marche(symbole)
    msg = message.lower()

    # Si l'utilisateur demande d'acheter/vendre explicitement
    if any(k in msg for k in ["achete", "achète", "prends du", "شراء", "buy"]):
        cote = "ACHAT"
    elif any(k in msg for k in ["vends", "vente", "جر", "sell"]):
        cote = "VENTE"
    else:
        cote = None

    if cote and config.BINANCE_PAPER:
        res = trader_paper(symbole, cote, config.BINANCE_CAPITAL_INITIAL / 5)
    elif cote and not config.BINANCE_PAPER:
        res = {"ok": False,
               "raison": "Mode reel desactive pour ta securite : garde BINANCE_PAPER=True tant que tu testes."}
    else:
        res = None

    ligne = (
        f"{analyse['texte']}\n"
        f"{symbole} : {analyse['prix']} USDT | "
        f"RSI {analyse['rsi']} | SMA10 {analyse['sma10']} | SMA20 {analyse['sma20']} | "
        f"Signal : {analyse['signal']}"
    )

    if res:
        if res.get("ok"):
            ligne += f"\n✅ (Paper) Tu as {res['action']} → portefeuille : {res['portefeuille']}"
        else:
            ligne += f"\n⚠️ Paper refusé : {res.get('raison')}"
    else:
        ligne += "\nDis-moi « cherche la meilleure opportunite » pour plus de details, ou « achete/vends + nom »."

    return {"symbole": symbole, "reponse": ligne, "analyse": analyse, "trade": res}
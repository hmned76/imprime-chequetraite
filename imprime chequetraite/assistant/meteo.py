"""
Module meteo d'AssistantAI : interroge Open-Meteo (API libre, sans cle)
pour donner la meteo reelle d'une ville, sans hallucination.

- Geocodage (ville -> lat/lon) : https://geocoding-api.open-meteo.com
- Previsions courantes          : https://api.open-meteo.com/v1/forecast
"""

import requests

_GEOCODER = "https://geocoding-api.open-meteo.com/v1/search"
_FORECAST = "https://api.open-meteo.com/v1/forecast"

# Noms de villes arabes <-> latins (le geocodeur ne comprend pas l'arabe).
_VILLES_AR = {
    "تونس": "Tunis", "باريس": "Paris", "صفاقس": "Sfax", "سوسة": "Sousse",
    "نابل": "Nabeul", "بنزرت": "Bizerte", "قابس": "Gabes", "القيروان": "Kairouan",
    "قفصة": "Gafsa", "توزر": "Tozeur", "المهدية": "Mahdia", "منوبة": "Manouba",
    "أريانة": "Ariana", "بن عروس": "Ben Arous", "زغوان": "Zaghouan",
    "باجة": "Beja", "جندوبة": "Jendouba", "الكاف": "Le Kef", "سليانة": "Siliana",
    "القصرين": "Kasserine", "سيدي بوزيد": "Sidi Bouzid", "مدنين": "Medenine",
    "تطاوين": "Tataouine", "قبلي": "Kebili", "الحمامات": "Hammamet",
    "المرسى": "La Marsa", "قرطاج": "Carthage",
}


def _latin(ville: str) -> str:
    """Convertit un nom de ville (arabe ou latin) vers le latin pour le geocodeur."""
    return _VILLES_AR.get(ville.strip(), ville.strip())


def _geocoder(ville: str):
    """Convertit un nom de ville en coordonnees (lat, lon, nom officiel)."""
    nom = _latin(ville)
    r = requests.get(
        _GEOCODER,
        params={"name": nom, "count": 1, "language": "fr", "format": "json"},
        timeout=10,
    )

# Codes meteo WMO -> description en francais
_CODES = {
    0: "ciel degage",
    1: "ciel plutot degage",
    2: "partiellement nuageux",
    3: "couvert",
    45: "brouillard",
    48: "brouillard gelant",
    51: "bruine legere",
    53: "bruine",
    55: "bruine dense",
    56: "bruine verglacante",
    57: "bruine verglacante dense",
    61: "pluie legere",
    63: "pluie",
    65: "pluie forte",
    66: "pluie verglacante",
    67: "pluie verglacante forte",
    71: "neige legere",
    73: "neige",
    75: "neige forte",
    77: "grains de neige",
    80: "averses de pluie",
    81: "averses",
    82: "averses violentes",
    85: "averses de neige",
    86: "averses de neige fortes",
    95: "orage",
    96: "orage avec grele",
    99: "orage violent avec grele",
}


def _geocoder(ville: str):
    """Convertit un nom de ville en coordonnees (lat, lon, nom officiel)."""
    nom = _latin(ville)
    r = requests.get(
        _GEOCODER,
        params={"name": nom, "count": 1, "language": "fr", "format": "json"},
        timeout=10,
    )
    r.raise_for_status()
    data = r.json()
    if not data.get("results"):
        return None
    res = data["results"][0]
    return {
        "lat": res["latitude"],
        "lon": res["longitude"],
        "nom": res.get("name", ville.capitalize()),
        "pays": res.get("country", ""),
    }


def obtenir_meteo(ville: str) -> dict:
    """Retourne la meteo actuelle d'une ville (dict) via Open-Meteo."""
    coord = _geocoder(ville)
    if not coord:
        return {"ok": False, "erreur": f"Je n'ai pas trouve la ville « {ville} »."}

    r = requests.get(
        _FORECAST,
        params={
            "latitude": coord["lat"],
            "longitude": coord["lon"],
            "current": (
                "temperature_2m,relative_humidity_2m,apparent_temperature,"
                "precipitation,weather_code,wind_speed_10m"
            ),
            "daily": "temperature_2m_max,temperature_2m_min",
            "forecast_days": 1,
            "timezone": "auto",
        },
        timeout=12,
    )
    r.raise_for_status()
    d = r.json()
    cur = d.get("current", {})

    code = cur.get("weather_code")
    desc = _CODES.get(code, "conditions variables")

    return {
        "ok": True,
        "ville": coord["nom"],
        "pays": coord["pays"],
        "temperature": cur.get("temperature_2m"),
        "ressenti": cur.get("apparent_temperature"),
        "humidite": cur.get("relative_humidity_2m"),
        "precipitations": cur.get("precipitation"),
        "vent": cur.get("wind_speed_10m"),
        "description": desc,
        "t_min": d.get("daily", {}).get("temperature_2m_min", [None])[0],
        "t_max": d.get("daily", {}).get("temperature_2m_max", [None])[0],
    }


def texte_meteo(ville: str) -> str:
    """Construit une phrase en francais a partir de la meteo reelle."""
    m = obtenir_meteo(ville)
    if not m.get("ok"):
        return m.get("erreur", "Impossible d'obtenir la meteo.")

    t = m["temperature"]
    ress = m["ressenti"]
    hum = m["humidite"]
    vent = m["vent"]
    desc = m["description"]
    pcp = m["precipitations"]

    phrase = f"Meteo a {m['ville']} ({m['pays']}) : {desc}, environ {t:.0f}°C"
    if ress is not None:
        phrase += f" (ressenti {ress:.0f}°C)"
    phrase += f", humidite {hum:.0f}%, vent a {vent:.1f} km/h."
    if pcp:
        phrase += f" Precipitations : {pcp:.1f} mm."
    if m.get("t_min") is not None and m.get("t_max") is not None:
        phrase += f" Aujourd'hui : min {m['t_min']:.0f}°C, max {m['t_max']:.0f}°C."
    return phrase

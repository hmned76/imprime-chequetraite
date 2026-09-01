# -*- coding: utf-8 -*-
"""
Recherche web generale pour Hmied (derja).
- Moteur principal : Wikipedia (API officielle fr, fiable, gratuite, sans cle).
- L'IA (OpenRouter) resume ensuite en derja tunisienne.
- Bing conserve un role secondaire si Wikipedia ne trouve rien (limite).
"""

import re
import time
import html as _html
import requests

# Wikipedia nous demande poliment de nous identifier et de respecter un rythme
USER_AGENT = "HmiedAssistant/1.0 (assistant tunisien; contact: hmned76)"
WIKI_API = "https://fr.wikipedia.org/w/api.php"


def _get(params: dict, tries: int = 3) -> dict:
    """GET Wikipedia API avec retry et respect du rythme (pas de rate-limit)."""
    for i in range(tries):
        try:
            r = requests.get(WIKI_API, params=params,
                             headers={"User-Agent": USER_AGENT}, timeout=15)
            if r.status_code == 200:
                return r.json()
        except Exception:
            pass
        time.sleep(1.0 + i)
    return None


def chercher_urls(query: str, n: int = 3) -> list:
    """Retourne les titres de pages Wikipedia les plus proches de la question."""
    data = _get({"action": "query", "list": "search", "srsearch": query,
                 "format": "json", "srlimit": n, "utf8": 1})
    if not data:
        return []
    return [h["title"] for h in data.get("query", {}).get("search", [])]


def _retirer_tags(html_text: str) -> str:
    html_text = re.sub(r"(?is)<(script|style|nav|footer|header|form)[^>]*>.*?</\1>", " ", html_text)
    html_text = re.sub(r"(?is)<br\s*/?>", "\n", html_text)
    html_text = re.sub(r"(?is)<[^>]+>", " ", html_text)
    html_text = _html.unescape(html_text)
    html_text = re.sub(r"[ \t]+", " ", html_text)
    html_text = re.sub(r"\n\s*\n+", "\n", html_text)
    return html_text.strip()


def _extrait_wiki(title: str, phrases: int = 5) -> str:
    """Extrait d'introduction d'une page Wikipedia (texte brut)."""
    data = _get({"action": "query", "prop": "extracts", "explaintext": 1,
                 "titles": title, "format": "json", "exintro": 1, "utf8": 1,
                 "exsentences": phrases})
    if not data:
        return ""
    for pid, p in data.get("query", {}).get("pages", {}).items():
        if "extract" in p:
            return p["extract"]
    return ""


def lire_page(url: str, max_car: int = 2500) -> str:
    """Compat : telecharge un extrait Wikipedia a partir d'un titre URL-encode."""
    title = url
    txt = _extrait_wiki(title)
    return txt[:max_car]


def trouver_extrait(query: str, texte: str) -> str:
    """Renvoie le premier paragraphe substantiel du texte."""
    for para in re.split(r"\n+", texte):
        if len(para.strip()) > 60:
            return para.strip()
    return texte.strip()


def recherche_web(query: str, nb_sites: int = 3) -> dict:
    """
    Recherche une question sur Wikipedia et lit les meilleurs resultats.
    Retourne {"titre", "liens", "contenus"}.
    """
    titres = chercher_urls(query, n=nb_sites)
    contenus = []
    for t in titres:
        txt = _extrait_wiki(t)
        if txt:
            extrait = trouver_extrait(query, txt)
            contenus.append({"url": t, "extrait": extrait})
        time.sleep(0.4)
    return {"titre": query, "liens": titres, "contenus": contenus}


def formater_reponse(res: dict) -> str:
    if not res["contenus"]:
        return ("ما لقيتش جواب واضح في الوب. قولّي السؤال بطريقة أخرى، "
                "ولاّ زيّد معلومات على اللي تدوّر عليه.")
    lignes = ["ها هو اللي لقيت ياخويا:"]
    for i, c in enumerate(res["contenus"], 1):
        ex = re.sub(r"\s+", " ", c["extrait"]).strip()
        if ex:
            lignes.append(f"\n{i}) {ex}")
    return "\n".join(lignes)


def repondre_question(question: str) -> str:
    """
    Cherche sur le web (Wikipedia), lit les pages, puis demande a l'IA
    (OpenRouter) de rediger une reponse derja claire.
    Retourne None si la recherche n'a rien donne (l'appelant retombe sur l'IA libre).
    """
    res = recherche_web(question, nb_sites=3)
    if not res["contenus"]:
        return None
    contexte = ""
    for c in res["contenus"]:
        ex = re.sub(r"\s+", " ", c["extrait"]).strip()
        if ex:
            contexte += f"- {ex}\n"
    if not contexte:
        return None
    prompt = (
        "Voici une question que l'utilisateur m'a posee :\n"
        f"QUESTION : {question}\n\n"
        "J'ai cherche sur le web et voici les informations trouvees :\n"
        f"{contexte}\n"
        "Reponds a la question en utilisant ces informations. Sois clair, juste et honnete. "
        "Parle en derja tunisienne, en lettres arabes, sans chiffres substituts (3/7/9/5/2/8). "
        "Donne la reponse directement, en 3 a 6 phrases, sans dire que tu cherchais sur le web."
    )
    try:
        from assistant import ia
        if not ia.est_actif():
            ia.configurer()
        rep = ia.generer(prompt)
        if rep:
            return rep
    except Exception as e:
        print("recherche.repondre_question erreur:", e)
    return formater_reponse(res)


if __name__ == "__main__":
    import sys
    q = " ".join(sys.argv[1:]) or "capitale du japon"
    r = recherche_web(q)
    print("LIENS:", r["liens"])
    for c in r["contenus"]:
        print("•", c["extrait"][:150].replace("\n", " "))

"""
Apprentissage automatique du style derja tunisien de l'utilisateur (Hamdi).

Hmied utilise son cerveau IA (OpenRouter ou Ollama) pour analyser les messages
de Hamdi, relever les expressions derja marquantes, les stocker en base
(table style_appris) puis les reinjecter dans le prompt pour lui repondre
dans SON dialecte. Le moteur d'extraction est donc l'IA elle-meme, pas une
liste figee.
"""

try:
    from assistant import storage, ia
except ImportError:
    import storage
    import ia


def apprendre_depuis_message(corps: str) -> int:
    """Analyse le message avec l'IA et stocke les expressions derja trouvees.
    Retourne le nombre d'expressions apprises."""
    if not corps:
        return 0
    if not ia.est_actif():
        print("[apprentissage] IA inactive, skip")
        return 0
    exprs = ia.extraire_style(corps)
    print("[apprentissage] extrait:", exprs)
    for expr in exprs:
        storage.incrementer_style(expr)
    return len(exprs)


def extraire_style_pour_prompt() -> str:
    """Rend les expressions apprises (utilisees >= 2 fois) sous forme lisible
    a injecter dans le prompt systeme."""
    rows = storage.lister_style_appris()
    if not rows:
        return ""
    exprs = [r["expression"] for r in rows]
    return "Ton style tunisien prefere a imiter : " + ", ".join(exprs) + "."

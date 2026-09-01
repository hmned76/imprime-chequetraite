"""
Transcription vocale (STT) avec Whisper.

Reconnait l'arabe tunisien (dialecte) beaucoup mieux que Google.
Le modele est charge une seule fois au premier appel.
"""

import os

from faster_whisper import WhisperModel

_MODELE = None
_TAILLE = os.environ.get("STT_MODELE", "small")


def transcrire(audio_bytes: bytes) -> str:
    """Reconnait la parole dans un fichier audio (m4a/aac/mp3/wav) et renvoie le texte."""
    global _MODELE
    if _MODELE is None:
        _MODELE = WhisperModel(_TAILLE, device="cpu", compute_type="int8")
    tmp = os.path.join(os.environ.get("TEMP", "/tmp"), "stt_entree.m4a")
    with open(tmp, "wb") as f:
        f.write(audio_bytes)
    segments, _info = _MODELE.transcribe(
        tmp,
        language=None,
        beam_size=1,
        vad_filter=True,
        condition_on_previous_text=False,
    )
    texte = "".join(s.text for s in segments).strip()
    return texte
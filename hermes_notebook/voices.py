"""Language → edge-tts voice pairs for spoken artifacts.

The `language` option used to steer only the SCRIPT — a Spanish episode was
still read by English voices. This maps a free-text language ("Spanish",
"es", "es-MX", "Brazilian Portuguese") onto a (host_a, host_b) neural voice
pair so the narration actually speaks the requested language.

Only locales with well-established edge-tts voices are listed; anything
unrecognized returns None and the caller keeps its configured default.
"""

from __future__ import annotations

import re
from typing import Optional

#: locale → (voice_a, voice_b). host_a tends to read as the lead voice.
_LOCALES = {
    "en": ("en-US-AndrewNeural", "en-US-EmmaNeural"),
    "en-gb": ("en-GB-RyanNeural", "en-GB-SoniaNeural"),
    "es": ("es-ES-AlvaroNeural", "es-ES-ElviraNeural"),
    "es-mx": ("es-MX-JorgeNeural", "es-MX-DaliaNeural"),
    "fr": ("fr-FR-HenriNeural", "fr-FR-DeniseNeural"),
    "de": ("de-DE-ConradNeural", "de-DE-KatjaNeural"),
    "it": ("it-IT-DiegoNeural", "it-IT-ElsaNeural"),
    "pt": ("pt-BR-AntonioNeural", "pt-BR-FranciscaNeural"),
    "pt-br": ("pt-BR-AntonioNeural", "pt-BR-FranciscaNeural"),
    "nl": ("nl-NL-MaartenNeural", "nl-NL-ColetteNeural"),
    "ja": ("ja-JP-KeitaNeural", "ja-JP-NanamiNeural"),
    "ko": ("ko-KR-InJoonNeural", "ko-KR-SunHiNeural"),
    "zh": ("zh-CN-YunxiNeural", "zh-CN-XiaoxiaoNeural"),
    "zh-cn": ("zh-CN-YunxiNeural", "zh-CN-XiaoxiaoNeural"),
    "hi": ("hi-IN-MadhurNeural", "hi-IN-SwaraNeural"),
    "ru": ("ru-RU-DmitryNeural", "ru-RU-SvetlanaNeural"),
    "pl": ("pl-PL-MarekNeural", "pl-PL-ZofiaNeural"),
    "tr": ("tr-TR-EmreNeural", "tr-TR-FilizNeural"),
    "uk": ("uk-UA-OstapNeural", "uk-UA-PolinaNeural"),
    "vi": ("vi-VN-NamMinhNeural", "vi-VN-HoaiMyNeural"),
    "id": ("id-ID-ArdiNeural", "id-ID-GadisNeural"),
    "th": ("th-TH-NiwatNeural", "th-TH-AcharaNeural"),
    "sv": ("sv-SE-MattiasNeural", "sv-SE-SofieNeural"),
    "da": ("da-DK-ChristofferNeural", "da-DK-ChristelNeural"),
    "fi": ("fi-FI-HarriNeural", "fi-FI-NooraNeural"),
    "nb": ("nb-NO-FinnNeural", "nb-NO-PernilleNeural"),
    "no": ("nb-NO-FinnNeural", "nb-NO-PernilleNeural"),
    "cs": ("cs-CZ-AntoninNeural", "cs-CZ-VlastaNeural"),
    "sk": ("sk-SK-LukasNeural", "sk-SK-ViktoriaNeural"),
    "hu": ("hu-HU-TamasNeural", "hu-HU-NoemiNeural"),
    "el": ("el-GR-NestorasNeural", "el-GR-AthinaNeural"),
    "he": ("he-IL-AvriNeural", "he-IL-HilaNeural"),
}

#: English language names → locale, for the "Spanish"-style inputs the UI hints at.
_NAMES = {
    "english": "en", "spanish": "es", "castilian": "es", "french": "fr",
    "german": "de", "italian": "it", "portuguese": "pt", "brazilian portuguese": "pt",
    "dutch": "nl", "flemish": "nl", "japanese": "ja", "korean": "ko",
    "chinese": "zh", "mandarin": "zh", "hindi": "hi", "russian": "ru",
    "polish": "pl", "turkish": "tr", "ukrainian": "uk", "vietnamese": "vi",
    "indonesian": "id", "thai": "th", "swedish": "sv", "danish": "da",
    "finnish": "fi", "norwegian": "nb", "czech": "cs", "slovak": "sk",
    "hungarian": "hu", "greek": "el", "hebrew": "he",
}


def _locale_for(language: str) -> Optional[str]:
    raw = re.sub(r"\s+", " ", str(language or "")).strip().lower()
    if not raw:
        return None
    # BCP-47-ish input first: "es-MX", "pt_br", "en_US"
    loc = re.sub(r"[_\s]+", "-", raw)
    if loc in _LOCALES:
        return loc
    head = loc.split("-")[0]
    if loc != head and head in _LOCALES:
        return head
    if raw in _NAMES:
        return _NAMES[raw]
    # last resort: bare ISO-639-1 code ("es", "fr")
    if re.fullmatch(r"[a-z]{2,3}", raw) and raw in _LOCALES:
        return raw
    return None


def pair_for(language: str) -> Optional[tuple[str, str]]:
    """(host_a_voice, host_b_voice) for a language string, or None."""
    loc = _locale_for(language)
    return _LOCALES.get(loc) if loc else None


def single_for(language: str) -> Optional[str]:
    """One narration voice (video) — the lead voice of the pair."""
    pair = pair_for(language)
    return pair[0] if pair else None

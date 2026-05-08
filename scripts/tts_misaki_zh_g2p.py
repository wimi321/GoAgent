#!/usr/bin/env python3
"""Official Misaki zh G2P bridge for GoAgent Kokoro bundled TTS.

The Electron app keeps Kokoro inference in Node/ONNX. This helper only performs
the official Chinese frontend step from misaki[zh]: Chinese text -> Kokoro
phoneme string. It reads JSON from stdin and writes JSON to stdout.
"""

from __future__ import annotations

import json
import re
import sys
from contextlib import redirect_stdout
from typing import Any


COORD_LETTER_SPEECH = {
    "A": "诶",
    "B": "比",
    "C": "西",
    "D": "迪",
    "E": "衣",
    "F": "艾弗",
    "G": "吉",
    "H": "艾尺",
    "J": "杰",
    "K": "凯",
    "L": "艾勒",
    "M": "艾姆",
    "N": "恩",
    "O": "欧",
    "P": "批",
    "Q": "丘",
    "R": "阿尔",
    "S": "艾斯",
    "T": "替",
}

ENGLISH_TERM_SPEECH = {
    "ai": "人工智能",
    "byo": "读秒",
    "byoyomi": "读秒",
    "goagent": "围棋智能体",
    "gpt": "大模型",
    "joseki": "定式",
    "katago": "卡塔狗",
    "komi": "贴目",
    "ko": "劫",
    "llm": "大模型",
    "openai": "欧盆人工智能",
    "pv": "参考变化",
    "scorelead": "目差",
    "scoreloss": "目差损失",
    "sgf": "棋谱文件",
    "sente": "先手",
    "gote": "后手",
    "tesuji": "手筋",
    "winrate": "胜率",
    "winrateloss": "胜率损失",
}

LATIN_CHAR_SPEECH = {
    "a": "诶",
    "b": "比",
    "c": "西",
    "d": "迪",
    "e": "衣",
    "f": "艾弗",
    "g": "吉",
    "h": "艾尺",
    "i": "艾",
    "j": "杰",
    "k": "凯",
    "l": "艾勒",
    "m": "艾姆",
    "n": "恩",
    "o": "欧",
    "p": "批",
    "q": "丘",
    "r": "阿尔",
    "s": "艾斯",
    "t": "替",
    "u": "优",
    "v": "维",
    "w": "达不溜",
    "x": "艾克斯",
    "y": "歪",
    "z": "贼德",
    "+": "加",
    "#": "井号",
    ".": "点",
    "-": "杠",
    "_": "下划线",
}


def number_to_chinese(value: int) -> str:
    digits = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"]
    if value < 0 or value > 99:
        return str(value)
    if value < 10:
        return digits[value]
    if value == 10:
        return "十"
    if value < 20:
        return "十" + digits[value % 10]
    tens = value // 10
    ones = value % 10
    return digits[tens] + "十" if ones == 0 else digits[tens] + "十" + digits[ones]


def normalize_text(text: str) -> str:
    def coord(match: re.Match[str]) -> str:
        letter = match.group(1).upper()
        number = int(match.group(2))
        letter_name = COORD_LETTER_SPEECH.get(letter)
        if not letter_name:
            return match.group(0)
        return f"{letter_name}{number_to_chinese(number)}"

    text = re.sub(r"\b([A-HJ-T])\s*(\d{1,2})\b", coord, text)
    text = re.sub(r"(\d+(?:\.\d+)?)\s*%", r"百分之\1", text)
    text = re.sub(r"\b([A-HJ-T])(?=\s*[点处位])", lambda match: COORD_LETTER_SPEECH.get(match.group(1).upper(), match.group(1)), text)
    text = re.sub(r"\b[A-Za-z][A-Za-z0-9+#._-]*\b", latin_token_to_speech, text)
    return text.strip()


def latin_token_to_speech(match: re.Match[str]) -> str:
    token = match.group(0)
    normalized = re.sub(r"[^a-z0-9]+", "", token.lower())
    if normalized in ENGLISH_TERM_SPEECH:
        return ENGLISH_TERM_SPEECH[normalized]
    pieces = []
    for char in token:
        lower = char.lower()
        if char.isdigit():
            pieces.append(number_to_chinese(int(char)))
        else:
            pieces.append(LATIN_CHAR_SPEECH.get(lower, char))
    return "".join(pieces)


def main() -> int:
    try:
        payload: dict[str, Any] = json.loads(sys.stdin.read() or "{}")
        raw_text = str(payload.get("text") or "")
        text = normalize_text(raw_text)
        if not text:
            raise ValueError("empty text")

        with redirect_stdout(sys.stderr):
            from misaki.zh import ZHG2P

            g2p = ZHG2P(version="1.1")
            phonemes, _ = g2p(text)
        phonemes = str(phonemes or "").strip()
        if not phonemes:
            raise RuntimeError("misaki[zh] returned empty phonemes")
        unknown_count = phonemes.count("❓")
        visible_count = len(phonemes.replace(" ", ""))
        if visible_count == 0 or unknown_count / max(visible_count, 1) > 0.2:
            raise RuntimeError(f"too many unknown phonemes from misaki[zh]: {unknown_count}/{visible_count}")

        print(json.dumps({
            "engine": "misaki.zh.ZHG2P",
            "version": "1.1",
            "text": text,
            "phonemes": phonemes,
            "unknownCount": unknown_count,
        }, ensure_ascii=False))
        return 0
    except Exception as exc:
        print(f"GoAgent Misaki zh G2P failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

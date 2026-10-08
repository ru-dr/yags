#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
import json
import sys

EMOJI = {
    "smile": "😄", "grin": "😁", "joy": "😂", "rofl": "🤣", "wink": "😉", "blush": "😊",
    "heart eyes": "😍", "kiss": "😘", "thinking": "🤔", "neutral": "😐", "eye roll": "🙄",
    "sleeping": "😴", "sunglasses": "😎", "cry": "😢", "sob": "😭", "angry": "😠",
    "scream": "😱", "party": "🥳", "skull": "💀", "clown": "🤡", "ghost": "👻", "alien": "👽",
    "robot": "🤖", "poop": "💩", "thumbs up": "👍", "thumbs down": "👎", "clap": "👏",
    "wave": "👋", "pray": "🙏", "muscle": "💪", "ok hand": "👌", "point up": "☝️",
    "eyes": "👀", "brain": "🧠", "heart": "❤️", "broken heart": "💔", "fire": "🔥",
    "sparkles": "✨", "star": "⭐", "100": "💯", "check": "✅", "cross": "❌", "warning": "⚠️",
    "question": "❓", "rocket": "🚀", "tada": "🎉", "gift": "🎁", "trophy": "🏆",
    "coffee": "☕", "pizza": "🍕", "beer": "🍺", "cake": "🍰", "apple": "🍎", "avocado": "🥑",
    "dog": "🐶", "cat": "🐱", "fox": "🦊", "panda": "🐼", "penguin": "🐧", "unicorn": "🦄",
    "sun": "☀️", "moon": "🌙", "rainbow": "🌈", "snowflake": "❄️", "zap": "⚡", "earth": "🌍",
    "computer": "💻", "keyboard": "⌨️", "phone": "📱", "bug": "🐛", "lock": "🔒", "key": "🔑",
    "bulb": "💡", "books": "📚", "memo": "📝", "calendar": "📅", "chart": "📈", "money": "💰",
    "house": "🏠", "car": "🚗", "plane": "✈️", "hourglass": "⏳", "bell": "🔔", "music": "🎵",
}
TONES = {"light": "\U0001F3FB", "medium": "\U0001F3FD", "dark": "\U0001F3FF"}
TONABLE = {"thumbs up", "thumbs down", "clap", "wave", "pray", "muscle", "ok hand", "point up"}


def query(request):
    words = request.get("query", "").lower().split()
    tone = TONES.get(request.get("settings", {}).get("skin-tone", "none"), "")
    results = []
    for name, char in EMOJI.items():
        if all(w in name for w in words):
            if tone and name in TONABLE:
                char = char[0] + tone + char[1:]
            results.append({
                "id": name,
                "title": f"{char}  {name}",
                "subtitle": "Enter copies the emoji",
                "icon": "face-smile-symbolic",
                "copy": char,
                "activate": {"copy": char},
                "preview": {"title": char, "kind": name, "details": [["Codepoints", " ".join(f"U+{ord(c):04X}" for c in char)]]},
            })
    return {"results": results[:30]}


def serve():
    for line in sys.stdin:
        request = json.loads(line)
        reply = query(request) if request.get("method") == "query" else {}
        print(json.dumps({"id": request.get("id"), **reply}), flush=True)


def main():
    method = sys.argv[1] if len(sys.argv) > 1 else "query"
    if method == "serve":
        serve()
        return
    request = json.loads(sys.stdin.readline() or "{}")
    print(json.dumps(query(request) if method == "query" else {}))


if __name__ == "__main__":
    main()

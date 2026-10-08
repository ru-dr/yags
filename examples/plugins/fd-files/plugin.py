#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
import json
import os
import shutil
import subprocess
import sys

LIMIT = 30


def command(query, root, hidden):
    fd = shutil.which("fd") or shutil.which("fdfind")
    if fd:
        return [fd, "--max-results", str(LIMIT), "--ignore-case", *(["--hidden"] if hidden else []), "--", query, root]
    return ["find", root, "-maxdepth", "6", *([] if hidden else ["-not", "-path", "*/.*"]), "-iname", f"*{query}*"]


def search(query, root, hidden):
    try:
        out = subprocess.run(command(query, root, hidden), capture_output=True, text=True, timeout=1.5).stdout
    except subprocess.TimeoutExpired as e:
        out = e.stdout.decode() if isinstance(e.stdout, bytes) else e.stdout or ""
    return [line.rstrip("/") for line in out.splitlines() if line][:LIMIT]


def result(path):
    home = os.path.expanduser("~")
    folder = os.path.dirname(path)
    short = "~" + folder[len(home):] if folder.startswith(home) else folder
    is_dir = os.path.isdir(path)
    return {
        "id": path,
        "title": os.path.basename(path),
        "subtitle": short,
        "icon": "folder-symbolic" if is_dir else "text-x-generic-symbolic",
        "path": path,
        "bookmark": path,
        "activate": {"open": path},
        "preview": {"kind": "Folder" if is_dir else "File", "details": [["Where", short]]},
    }


def main():
    method = sys.argv[1] if len(sys.argv) > 1 else "query"
    request = json.loads(sys.stdin.readline() or "{}")
    query = request.get("query", "").strip()
    if method != "query" or not query:
        print("{}")
        return
    settings = request.get("settings", {})
    root = os.path.expanduser(settings.get("root") or "~")
    print(json.dumps({"results": [result(p) for p in search(query, root, settings.get("hidden", False))]}))


if __name__ == "__main__":
    main()

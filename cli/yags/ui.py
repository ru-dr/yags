# SPDX-License-Identifier: GPL-3.0-or-later
import sys

_TTY = sys.stdout.isatty()


class CliError(Exception):
    pass


def paint(code, text):
    return f"\033[{code}m{text}\033[0m" if _TTY else str(text)


def bold(text):
    return paint("1", text)


def dim(text):
    return paint("2", text)


def accent(text):
    return paint("36", text)


def ok(text):
    print(f"{paint('32', '✔')} {text}")


def warn(text):
    print(f"{paint('33', '!')} {text}")


def bad(text):
    print(f"{paint('31', '✘')} {text}")


def fmt(value):
    if isinstance(value, bool):
        return paint("32", "on") if value else dim("off")
    if isinstance(value, list):
        return ", ".join(map(str, value)) if value else dim("(none)")
    return str(value)


def table(rows):
    if not rows:
        return
    widths = [max(len(str(row[i])) for row in rows) for i in range(len(rows[0]) - 1)]
    for row in rows:
        cells = [accent(str(row[0]).ljust(widths[0]))]
        cells += [str(cell).ljust(widths[i]) for i, cell in enumerate(row[1:-1], start=1)]
        cells.append(dim(row[-1]))
        print("  " + "  ".join(cells))

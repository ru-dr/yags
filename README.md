# yags

**Yet Another GNOME Search.** A macOS-inspired launcher for GNOME Shell 48 to 51 on Wayland, with PowerToys Run style plugins.

Press `Super + Space`, type, hit `Enter`.

📖 **Full documentation: [the yags wiki](https://github.com/ru-dr/yags/wiki)**

---

## Install

```bash
git clone https://github.com/ru-dr/yags.git
cd yags
./bin/yags install          # copies into ~/.local/share/gnome-shell/extensions/yags@ru-dr
                            # and links the yags CLI into ~/.local/bin
# log out and back in (Wayland loads new extensions only at login)
yags enable
yags doctor
```

`./bin/yags install --link` symlinks the checkout instead, for development.

**Optional:** `plocate` for file search, and Copyous for clipboard history.

---

## Prefixes

Type a prefix to search only one plugin. Without a prefix, everything is searched together.

| Prefix | Plugin | Example |
|---|---|---|
| `=` | Calculator | `= 2pi`, `= sqrt(2)*3` |
| `>` | Shell | `> pwd` shows live output, `Enter` runs in a terminal |
| `<` | Open windows | `< firefox` |
| `?` | Files | `? report` |
| `??` | Web search | `?? gnome shell` |
| `*` | Bookmarks | `* docs`, `*+ ~/Projects` adds one |
| `:` | Clipboard | `: password` |

`yags keywords` prints this list. `yags feature off keywords` turns prefixes off.

## Plugins

**Calculator and dev tools.** These work without a prefix whenever the query looks like one:
- **Math:** `+ - * / % ^ **`, `//` (floor division), `mod`, `!`, parentheses, and functions (`sqrt cbrt abs sin cos tan asin acos atan ln log log2 log10 exp floor ceil round min max pow hypot gcd lcm avg sum deg rad`). Constants: `pi e tau phi`.
- **Bases and bitwise:** `0xff`, `0b1010`, `0o17`, `&`, `|`, `xor`, `~`, `<<`, `>>`. Results also show hex, binary and octal. `255 to hex`, `0xff to dec`.
- **Units:** length, mass, volume, area, time, speed, data (`GiB`, `MB`, `Mb`), pressure, energy, angle, temperature. `10 km to mi`, `100 f in c`, `1 GiB to MB`.
- **Currency:** `50 usd to inr`, `100 eur` (converts into the `currencies` list). Daily rates from open.er-api.com, cached in `~/.cache/yags/rates.json`.
- **Generators:** `uuid`, `md5|sha1|sha256|sha384|sha512 text`, `base64 text`, `base64d text`, `url text`, `urldecode text`, `password 24`, `random 1 100`.
- **Time:** `now` (local, ISO 8601, Unix seconds and milliseconds), and a 10 or 13 digit Unix timestamp gives its date.
- **Colours:** `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb()`, `rgba()`, `hsl()`. Rows for HEX, RGB, HSL, HSV and CMYK. The preview shows a five-step spectrum (two darker shades, the colour, two lighter tints; click one to copy it), plus contrast against white and black with the WCAG grade, and luminance.

`Enter` copies any calculator result.

**Shell (`>`).** `> pwd`, `> ls`, `> git status` and other read-only commands show live output in the preview as you type. `Enter` runs any command in your terminal. Live previews:
- only run commands on the `shell-preview-commands` allowlist
- run without a shell, so globs, pipes, redirects and substitutions do nothing
- never run anything containing `; | & < > $ ( ) { } [ ] * ? = !`, a backtick, or options like `-o`/`--output`
- stop after 2 seconds or 6000 characters

**Bookmarks.** yags keeps its own bookmarks for files, folders, locations, commands and sites. They show up in normal results, or use `*` to search only bookmarks. There are three ways to add one:

- **From any result:** select a file, folder, URL or shell command and press `Ctrl + D`, or click ☆ on the row. On a bookmark, `Ctrl + D` or the trash button removes it.
- **By typing:** `*+ ~/Projects`, `*+ docs ~/Documents`, `*+ gh https://github.com/ru-dr`, `*+ nas sftp://nas.local/home`, `*+ disk usage > df -h`, then `Enter`. The name is optional.
- **Preferences → Bookmarks:** add with file and folder pickers, see all bookmarks, delete them.

The CLI works too:

```bash
yags bookmark add docs ~/Documents
yags bookmark list
yags bookmark rm docs
```

**Web.**
- Every search ends with a "Search the web" row.
- Typing a URL or domain opens it.
- Site shortcuts: `g`, `ddg`, `yt`, `gh`, `w`, `maps`, `r`, `so`, `mdn`, `npm`, `pypi`, `aw` (for example `yt lofi`). Configure them with `yags set web-shortcuts 'key|Name|https://site/?q=%s, …'`.

**Windows (`<`).** Switch to any open window by title or app name.

**Files (`?`).** Uses the plocate index, plus recently used files and a live listing of your home folder, Desktop, Documents, Downloads, Pictures, Music and Videos. Ranked by name match, recency and depth. Package caches are skipped (`exclude-paths`).

**Clipboard (`:` or `Super + 4`).** Searches your Copyous history. `Enter` copies the entry.

---

## Look and feel

- A floating pill search bar, with results in a separate card below and a preview pane beside them.
- **Top Hit**, **inline completion** (`Tab` or `→` accepts it), and the bar icon follows the selected result.
- Action buttons on the selected row: new window, open containing folder, copy.
- Filter buttons for Apps, Files, Actions and Clipboard (`Super + 1` to `4`).
- Remembers the last search, and opens with a slight bounce.
- `yags style powertoys` switches to a single-window PowerToys Run layout, `yags style mac` switches back.

## Keys

| Key | Action |
|---|---|
| `Super + Space` | Open or close |
| `Super` / `Esc` | Close |
| `↑` `↓` | Move through results |
| `Tab` `→` | Accept the inline completion |
| `Enter` | Open or run the selected result |
| `Ctrl + Enter` | New window of the selected app |
| `Ctrl + Shift + E` / `Super + Enter` | Open the containing folder |
| `Ctrl + Shift + C` / `Super + C` | Copy the path or value |
| `Ctrl + D` | Bookmark the selected file, folder, URL or command, or remove a bookmark |
| `Super + 1` to `4` | Apps, Files, Actions, Clipboard filter |
| `Backspace` on an empty bar | Clear the filter |

---

## Configure

Everything applies live, no log out needed.

```bash
yags                              # status and help
yags list                         # every setting
yags feature                      # feature switches
yags feature off preview bounce
yags provider                     # every search source, with on/off state
yags provider off contacts calendar
yags style mac                    # mac | powertoys
yags theme dark                   # default | dark | light
yags shortcut super+space
yags accent '#ff375f'
yags set corner-radius 14         # the card, bar, rows and preview all follow it
yags set width 760
yags set max-rows 7
yags set font-size 22
yags set opacity 90
yags set top-offset 25
yags set placeholder 'Search anything'
yags set search-engine 'https://duckduckgo.com/?q=%s'
yags set currencies 'USD, EUR, INR'
yags set terminal kitty
yags reset --all
yags prefs                        # graphical preferences
yags doctor                       # dependencies and shortcut conflicts
```

Feature switches: `top-hit`, `completion`, `bar-icon`, `preview`, `filters`, `remember-query`, `bounce`, `file-search`, `clipboard`, `file-actions`, `calculator-style`, `keywords`, `row-actions`, `currency`, `web-fallback`, `shell-preview`.

---

## Troubleshooting

- **The bar is invisible, or GNOME search breaks at login:** an extension is hiding the Overview search (Just Perfection's *Search* option). Turn that option on.
- **`Super + Space` does nothing:** `yags doctor` lists anything else bound to the same keys.
- **A new file doesn't show up:** plocate reindexes daily. `sudo updatedb` refreshes it now.
- **No currency results:** check your connection. Rates are fetched at most every 12 hours, and failures retry after 10 minutes.

---

## Credits

yags is a fork of [Spotlight](https://github.com/itsnin/spotlight) by itsnin, reworked by [ru-dr](https://github.com/ru-dr).

GPL-3.0-or-later, see [LICENSE](LICENSE).

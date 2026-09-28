# yags

**Yet Another GNOME Search.** A macOS-inspired, keyboard-driven launcher for GNOME Shell 45 to 51 on Wayland.

Press `Super + Space`, type, hit `Enter`.

---

## Install

```bash
git clone https://github.com/ru-dr/yags.git
cd yags
./bin/yags install          # copies into ~/.local/share/gnome-shell/extensions/yags@ru-dr
                            # and links the yags CLI into ~/.local/bin
# log out and back in (Wayland loads new extensions only at login)
yags enable
yags doctor                 # checks plocate, shortcut conflicts, clipboard manager
```

For development, `./bin/yags install --link` symlinks the checkout instead of copying it. Code changes still need a log out, but settings changes apply instantly.

**Optional dependencies**
- `plocate` for fast file search (preinstalled on Fedora). The index refreshes daily. Recently used files and anything directly in your home folder, Desktop, Documents, Downloads, Pictures, Music and Videos show up right away.
- Copyous, for the Clipboard filter.

---

## Features

| Feature | What it does |
|---|---|
| **Top Hit** | The best match gets its own section at the top, with a larger icon |
| **Inline completion** | Typing `fir` shows faded `efox — Application`. `Tab` or `→` accepts it |
| **Bar icon** | The magnifier turns into the selected result's icon |
| **Preview pane** | Details beside the list: app description, file size and dates, thumbnails, clipboard contents |
| **Filters** | Apps, Files, Actions and Clipboard buttons, `Super + 1` to `Super + 4`. `Backspace` on an empty bar clears the filter |
| **File search** | The plocate index, plus recent and fresh files, ranked by name match, recency and depth. Package caches are skipped |
| **File actions** | `Super + Enter` shows the file in Files, `Super + C` copies its path |
| **Calculator and conversion** | `12*7`, `10 km in miles`, `50 usd to inr`, answers first. Enter copies the answer |
| **Remember last search** | Reopening shows the previous query, selected, so typing replaces it |
| **Bounce** | A slight spring when it opens |
| **Everything GNOME searches** | Apps, Settings panels, system actions (`lock`, `suspend`), contacts, and any app that plugs into GNOME search |

## Keys

| Key | Action |
|---|---|
| `Super + Space` | Open or close |
| `Super` | Close |
| `↑` `↓` | Move through results |
| `Tab` `→` | Accept the inline completion |
| `Enter` | Open the selected result |
| `Super + 1` to `4` | Apps, Files, Actions, Clipboard filter |
| `Super + Enter` | Show the selected file in Files |
| `Super + C` | Copy the selected file's path |
| `Esc` | Close |

---

## Configure

Every setting applies live, no log out needed.

```bash
yags                              # status and help
yags list                         # every setting and its value
yags feature                      # feature switches
yags feature off preview bounce   # turn features off
yags feature on all
yags theme dark                   # default | dark | light
yags shortcut super+space
yags accent '#ff375f'
yags set width 760
yags set top-offset 25
yags set max-rows 7
yags set font-size 22
yags set corner-radius 18
yags set opacity 90
yags set placeholder 'Search anything'
yags set exclude-paths '/go/pkg/mod/, /sdk/, /node_modules/'
yags reset width                  # or: yags reset --all
yags prefs                        # the graphical preferences window
yags doctor
```

| Setting | Default | Range |
|---|---|---|
| `width` | 680 | 400 to 1200 px |
| `top-offset` | 22 | 5 to 60 % of screen height |
| `max-rows` | 5 | 1 to 15 per section |
| `font-size` | 20 | 12 to 32 px |
| `corner-radius` | 26 | 0 to 40 px |
| `opacity` | 96 | 50 to 100 % |
| `accent-color` | `#0a84ff` | `#rrggbb` |
| `placeholder` | `Yags Search` | any text |
| `exclude-paths` | Go, SDK, Cargo and Rustup caches | comma-separated path fragments |

Feature switches: `top-hit`, `completion`, `bar-icon`, `preview`, `filters`, `remember-query`, `bounce`, `file-search`, `clipboard`, `file-actions`, `calculator-style`.

---

## Troubleshooting

- **The bar is invisible or GNOME search breaks at login:** an extension is hiding the Overview search (Just Perfection's *Search* option). Turn that option on. yags replaces the Overview search anyway.
- **`Super + Space` doesn't open it:** run `yags doctor`, which lists anything else bound to the same keys (for example keyboard-layout switching).
- **A new file doesn't show up:** plocate reindexes daily. Run `sudo updatedb` to refresh now.

---

## Credits

yags is a fork of [Spotlight](https://github.com/itsnin/spotlight) by itsnin, reworked with a new look, new features and a configuration tool by [ru-dr](https://github.com/ru-dr).

Licensed under GPL-3.0-or-later, see [LICENSE](LICENSE).

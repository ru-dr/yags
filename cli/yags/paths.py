# SPDX-License-Identifier: GPL-3.0-or-later
import os
from pathlib import Path

UUID = "yags@ru-dr"
SCHEMA = "org.gnome.shell.extensions.yags"
REPO = Path(__file__).resolve().parents[2]
DATA_HOME = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local/share"))
CONFIG_HOME = Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config"))
EXTENSION_DIR = DATA_HOME / "gnome-shell" / "extensions" / UUID
USER_PLUGINS = DATA_HOME / "yags" / "plugins"
USER_STYLES = CONFIG_HOME / "yags" / "styles"
BOOKMARKS_FILE = CONFIG_HOME / "yags" / "bookmarks.json"
BIN_DIR = Path.home() / ".local" / "bin"
SEARCH_PROVIDER_DIRS = [Path("/usr/share/gnome-shell/search-providers"), DATA_HOME / "gnome-shell" / "search-providers"]
EXTENSION_PAYLOAD = ["extension.js", "metadata.json", "prefs.js", "stylesheet.css", "LICENSE", "lib", "prefs", "schemas", "plugins"]

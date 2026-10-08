// SPDX-License-Identifier: GPL-3.0-or-later
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import St from 'gi://St';
import {LOOK_KEYS} from './config.js';
import {buildCss} from './css.js';

const STYLE_FILE = GLib.build_filenamev([GLib.get_user_cache_dir(), 'yags', 'custom.css']);
export class StyleSheet {
    constructor(config) {
        this._config = config;
        this._file = Gio.File.new_for_path(STYLE_FILE);
        this._theme = null;
    }

    enable() {
        this._context.connectObject('changed', () => {
            if (this._context.get_theme() !== this._theme)
                this._load();
        }, this);
        this._config.onChanged(LOOK_KEYS, () => this._load(), this);
        this._load();
    }

    disable() {
        this._config.disconnect(this);
        this._context.disconnectObject(this);
        this._unload();
    }

    get _context() {
        return St.ThemeContext.get_for_stage(global.stage);
    }

    _load() {
        this._unload();
        GLib.mkdir_with_parents(GLib.path_get_dirname(STYLE_FILE), 0o755);
        this._file.replace_contents(new TextEncoder().encode(buildCss(this._config)),
            null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
        this._theme = this._context.get_theme();
        this._theme.load_stylesheet(this._file);
    }

    _unload() {
        this._theme?.unload_stylesheet(this._file);
        this._theme = null;
    }
}

// SPDX-License-Identifier: GPL-3.0-or-later
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import St from 'gi://St';

const KEYS = ['accent-color', 'corner-radius', 'opacity', 'font-size', 'style'];

function rgb(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    const n = parseInt(m ? m[1] : '0a84ff', 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function important(css) {
    return css.replace(/:\s*([^;{}]+?)\s*(!important)?\s*;/g, ': $1 !important;');
}

function build(settings) {
    const style = settings.get_string('style');
    const C = `.yags-container.yags-custom.yags-style-${style}`;
    const L = `${C}.theme-light`;
    const [r, g, b] = rgb(settings.get_string('accent-color'));
    const accent = `rgb(${r}, ${g}, ${b})`;
    const alpha = settings.get_int('opacity') / 100;
    const radius = settings.get_int('corner-radius');
    const win = Math.round(radius * 0.3);
    const inner = Math.max(win - 2, 0);
    const small = Math.max(win - 4, 0);
    const font = settings.get_int('font-size');
    const rows = [':selected', ':focus', ':selected:hover', ':focus:hover'];
    const selected = [C, L].flatMap(p => rows.map(s => `${p} .list-search-result${s}`)).join(',\n');
    const entries = [C, L].flatMap(p => ['', ':hover', ':focus'].map(s => `${p} .yags-bar StEntry${s}`)).join(', ');
    let css = `
${entries} {
  caret-color: ${accent};
  selection-background-color: rgba(${r}, ${g}, ${b}, 0.4);
  font-size: ${font}px;
}
${C} .yags-ghost { font-size: ${font}px; }
${C} .yags-filter-button:checked, ${L} .yags-filter-button:checked { background-color: ${accent}; }
`;
    if (style === 'mac') {
        const line = Math.max(34, Math.round(font * 1.5));
        const pill = Math.round((line + 22 + 2) / 2);
        css += `
${C} .yags-bar, ${C} .yags-results { background-color: rgba(36, 36, 38, ${alpha}); }
${L} .yags-bar, ${L} .yags-results { background-color: rgba(248, 248, 250, ${alpha}); }
${C} .yags-results { border-radius: ${radius}px; }
${C} .yags-bar { border-radius: ${Math.min(pill, radius + 3)}px; }
${entries} { min-height: ${line}px; }
${C} .list-search-result { border-radius: ${Math.round(radius * 0.4)}px; }
${C} .yags-preview { border-radius: ${Math.round(radius * 0.7)}px; }
${C} .yags-filter-button { border-radius: ${Math.round(Math.min(pill, radius + 3) * 0.55)}px; }
${selected} { background-color: ${accent}; }
`;
    } else {
        const line = Math.max(30, Math.round(font * 1.5));
        css += `
${C} { background-color: rgba(32, 32, 32, ${alpha}); border-radius: ${win}px; }
${L} { background-color: rgba(243, 243, 243, ${alpha}); }
${C} .yags-bar { border-radius: ${inner}px; }
${entries} { min-height: ${line}px; }
${C} .list-search-result { border-radius: ${inner}px; }
${C} .yags-preview { border-radius: ${inner}px; }
${C} .yags-row-action, ${C} .yags-filter-button { border-radius: ${small}px; }
${C} .yags-bar-underline { background-color: ${accent}; }
${C} .list-search-result:selected .yags-row-indicator, ${C} .list-search-result:focus .yags-row-indicator { background-color: ${accent}; }
`;
    }
    return important(css);
}

export class CustomStyle {
    constructor(settings) {
        this._settings = settings;
        this._file = Gio.File.new_for_path(
            GLib.build_filenamev([GLib.get_user_cache_dir(), 'yags', 'custom.css']));
        this._loadedTheme = null;
        St.ThemeContext.get_for_stage(global.stage).connectObject('changed', () => {
            if (this._theme() !== this._loadedTheme) {
                this._loadedTheme = null;
                this.apply();
            }
        }, this);
        this._settings.connectObject(
            ...KEYS.flatMap(k => [`changed::${k}`, () => this.apply()]), this);
        this.apply();
    }

    _theme() {
        return St.ThemeContext.get_for_stage(global.stage).get_theme();
    }

    apply() {
        this._unload();
        const dir = this._file.get_parent();
        if (!dir.query_exists(null))
            dir.make_directory_with_parents(null);
        this._file.replace_contents(new TextEncoder().encode(build(this._settings)),
            null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
        this._loadedTheme = this._theme();
        this._loadedTheme.load_stylesheet(this._file);
    }

    _unload() {
        this._loadedTheme?.unload_stylesheet(this._file);
        this._loadedTheme = null;
    }

    destroy() {
        this._settings.disconnectObject(this);
        St.ThemeContext.get_for_stage(global.stage).disconnectObject(this);
        this._unload();
    }
}

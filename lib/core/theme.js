// SPDX-License-Identifier: GPL-3.0-or-later
import Gio from 'gi://Gio';

const LIGHT_CLASS = 'theme-light';

export class ThemeWatcher {
    constructor(config, onChanged) {
        this._config = config;
        this._onChanged = onChanged;
        this._interface = new Gio.Settings({schema_id: 'org.gnome.desktop.interface'});
    }

    enable() {
        this._interface.connectObject('changed::color-scheme', () => this._onChanged(), this);
        this._config.onChanged(['theme-preference'], () => this._onChanged(), this);
    }

    disable() {
        this._interface.disconnectObject(this);
        this._config.disconnect(this);
    }

    get isLight() {
        const preference = this._config.theme;
        if (preference !== 'default')
            return preference === 'light';
        return this._interface.get_string('color-scheme') === 'prefer-light';
    }

    applyTo(actor) {
        if (this.isLight)
            actor.add_style_class_name(LIGHT_CLASS);
        else
            actor.remove_style_class_name(LIGHT_CLASS);
    }
}

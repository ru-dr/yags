// SPDX-License-Identifier: GPL-3.0-or-later
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {YagsPopup} from './lib/popup/widget/yagsPopup.js';
import {KeybindingManager} from './lib/core/keybinding.js';

export default class YagsExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._popup = new YagsPopup(this._settings);
        this._popup.stealOverviewSearch();
        this._keybindingManager = new KeybindingManager();
        this._keybindingManager.enable();
        const shortcuts = this._settings.get_strv('toggle-shortcut');
        const accelerator = shortcuts.length > 0 ? shortcuts[0] : '<Super>space';
        if (shortcuts.length === 0)
            this._settings.set_strv('toggle-shortcut', [accelerator]);
        this._grabShortcut(accelerator);
        this._settings.connectObject('changed::toggle-shortcut', () => {
            this._keybindingManager.unlisten();
            const arr = this._settings.get_strv('toggle-shortcut');
            if (arr.length > 0)
                this._grabShortcut(arr[0]);
        }, this);
    }
    _grabShortcut(accelerator) {
        this._keybindingManager.listenFor(accelerator, () => {
            if (this._popup._visible)
                this._popup.close();
            else
                this._popup.open();
        });
    }
    disable() {
        this._settings.disconnectObject(this);
        this._keybindingManager.disable();
        this._keybindingManager = null;
        this._popup.returnOverviewSearch();
        this._popup.destroy();
        this._popup = null;
        this._settings = null;
    }
}

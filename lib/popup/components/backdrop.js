// SPDX-License-Identifier: GPL-3.0-or-later
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export class PopupBackdrop {
    constructor(onClickOutside, monitor) {
        this._actor = new St.Widget({
            reactive: true,
            can_focus: false,
            visible: false,
        });
        this._actor.set_size(monitor.width, monitor.height);
        this._actor.set_position(monitor.x, monitor.y);
        this._actor.connectObject('button-release-event', () => {
            onClickOutside();
            return Clutter.EVENT_STOP;
        }, this._actor);
    }

    show() {
        Main.layoutManager.addChrome(this._actor);
        this._actor.show();
    }

    destroy() {
        this._actor.disconnectObject(this._actor);
        Main.layoutManager.removeChrome(this._actor);
        this._actor.destroy();
    }
}

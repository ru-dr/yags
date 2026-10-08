// SPDX-License-Identifier: GPL-3.0-or-later
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export class Backdrop {
    constructor(monitor, onClick) {
        this._actor = new St.Widget({reactive: true, can_focus: false});
        this._actor.set_size(monitor.width, monitor.height);
        this._actor.set_position(monitor.x, monitor.y);
        this._actor.connect('button-release-event', () => {
            onClick();
            return Clutter.EVENT_STOP;
        });
        Main.layoutManager.addChrome(this._actor);
    }

    destroy() {
        Main.layoutManager.removeChrome(this._actor);
        this._actor.destroy();
    }
}

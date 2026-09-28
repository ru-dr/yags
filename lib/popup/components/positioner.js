// SPDX-License-Identifier: GPL-3.0-or-later
import GLib from 'gi://GLib';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export class PopupPositioner {
    constructor(popup) {
        this._popup = popup;
        this._idleId = 0;
    }

    showCentered(onShown) {
        const monitor = this.getTargetMonitor();

        const popupWidth = Math.min(this._popup._settings.get_int('width'), Math.floor(monitor.width * 0.85));
        this._popup.set_width(popupWidth);
        this._popup._content.set_width(popupWidth);
        this._popup.queue_relayout();

        this._idleId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._idleId = 0;
            this._center(popupWidth, monitor);
            this._animateOpen(onShown);
            return GLib.SOURCE_REMOVE;
        });
    }

    getTargetMonitor() {
        const [px, py] = global.get_pointer();
        for (const m of Main.layoutManager.monitors) {
            if (px >= m.x && px < m.x + m.width &&
                py >= m.y && py < m.y + m.height) {
                return m;
            }
        }
        return Main.layoutManager.primaryMonitor;
    }

    _center(popupWidth, monitor) {
        this._popup.set_position(
            Math.floor(monitor.x + (monitor.width - popupWidth) / 2),
            Math.floor(monitor.y + monitor.height * this._popup._settings.get_int('top-offset') / 100),
        );
    }

    _animateOpen(onShown) {
        const stSettings = St.Settings.get();
        if (stSettings && !stSettings.enable_animations) {
            this._popup.opacity = 255;
            this._popup.scale_x = 1.0;
            this._popup.scale_y = 1.0;
            this._popup.show();
            onShown();
            return;
        }
        this._popup.remove_transition('opacity');
        this._popup.remove_transition('scale-x');
        this._popup.remove_transition('scale-y');
        this._popup.opacity = 0;
        this._popup.scale_x = 0.94;
        this._popup.scale_y = 0.94;
        this._popup.show();
        onShown();
        this._popup.ease({
            opacity: 255,
            duration: 140,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });
        const bounce = this._popup._settings.get_boolean('feature-bounce');
        this._popup.ease({
            scale_x: 1.0,
            scale_y: 1.0,
            duration: bounce ? 320 : 180,
            mode: bounce ? Clutter.AnimationMode.EASE_OUT_BACK : Clutter.AnimationMode.EASE_OUT_QUAD,
        });
    }

    stop() {
        if (this._idleId) {
            GLib.source_remove(this._idleId);
            this._idleId = 0;
        }
    }
}

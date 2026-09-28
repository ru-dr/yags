// SPDX-License-Identifier: GPL-3.0-or-later
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';

export function installCloseDefense(popup, search, entry) {
    search.connectObject(
        'button-press-event', () => {
            GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                if (popup._visible)
                    popup.close();
                return GLib.SOURCE_REMOVE;
            });
            return Clutter.EVENT_PROPAGATE;
        },
        popup,
    );

    global.stage.connectObject(
        'captured-event', (actor, event) => {
            if (event.type() !== Clutter.EventType.KEY_PRESS)
                return Clutter.EVENT_PROPAGATE;

            const key = event.get_key_symbol();

            if (key === Clutter.KEY_Escape) {
                popup.close();
                return Clutter.EVENT_STOP;
            }

            if (key === Clutter.KEY_Return ||
                key === Clutter.KEY_KP_Enter ||
                key === Clutter.KEY_space) {
                const focus = global.stage.get_key_focus();
                if (focus &&
                    focus !== entry &&
                    !entry.contains(focus) &&
                    popup.contains(focus) &&
                    (!focus.has_style_class_name ||
                     !focus.has_style_class_name('popup-menu'))) {
                    popup.close();
                }
            }

            return Clutter.EVENT_PROPAGATE;
        },
        popup,
    );

    global.stage.connectObject(
        'notify::key-focus', () => {
            if (!popup._visible)
                return;
            const focus = global.stage.get_key_focus();

            if (!focus) {
                entry.grab_key_focus();
                return;
            }

            if (entry && (entry === focus || entry.contains(focus)))
                return;

            if (popup.contains(focus))
                return;

            if (focus.has_style_class_name &&
                focus.has_style_class_name('popup-menu'))
                return;

            popup.close();
        },
        popup,
    );

    popup._focusWindowId = global.display.connect(
        'notify::focus-window', () => {
            if (!popup._visible)
                return;
            if (global.display.focus_window !== null)
                popup.close();
        },
    );
}

export function uninstallCloseDefense(popup, search) {
    global.stage.disconnectObject(popup);
    if (popup._focusWindowId) {
        global.display.disconnect(popup._focusWindowId);
        popup._focusWindowId = 0;
    }
    if (search)
        search.disconnectObject(popup);
}

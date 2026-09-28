// SPDX-License-Identifier: GPL-3.0-or-later
import GLib from 'gi://GLib';

export function scheduleIdle(popup, idProperty, callback) {
    if (popup[idProperty] !== 0)
        return false;
    popup[idProperty] = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
        popup[idProperty] = 0;
        callback();
        return GLib.SOURCE_REMOVE;
    });
    return true;
}

export function cancelIdle(popup, idProperty) {
    if (popup[idProperty] !== 0) {
        GLib.source_remove(popup[idProperty]);
        popup[idProperty] = 0;
    }
}

export function trackTextVisibility(search) {
    return search._text.connect('text-changed', () => {
        search.visible = search._text.get_text().length > 0;
    });
}

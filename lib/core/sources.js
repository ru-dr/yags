// SPDX-License-Identifier: GPL-3.0-or-later
import GLib from 'gi://GLib';

export class SourceTracker {
    constructor() {
        this._named = new Map();
    }

    idle(name, callback) {
        return this._add(name, GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => this._fire(name, callback)));
    }

    timeout(name, ms, callback) {
        return this._add(name, GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => this._fire(name, callback)));
    }

    isPending(name) {
        return this._named.has(name);
    }

    cancel(name) {
        const id = this._named.get(name);
        if (id) {
            GLib.source_remove(id);
            this._named.delete(name);
        }
    }

    clear() {
        for (const id of this._named.values())
            GLib.source_remove(id);
        this._named.clear();
    }

    _add(name, id) {
        this.cancel(name);
        this._named.set(name, id);
        return id;
    }

    _fire(name, callback) {
        this._named.delete(name);
        callback();
        return GLib.SOURCE_REMOVE;
    }
}

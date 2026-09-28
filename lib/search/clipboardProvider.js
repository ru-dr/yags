// SPDX-License-Identifier: GPL-3.0-or-later
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const COPYOUS_UUID = 'copyous@boerdereinar.dev';
const MAX_RESULTS = 20;
const TYPE_ICONS = {
    Text: 'edit-paste-symbolic',
    Code: 'text-x-script-symbolic',
    Image: 'image-x-generic-symbolic',
    File: 'text-x-generic-symbolic',
    Files: 'folder-symbolic',
    Link: 'web-browser-symbolic',
    Character: 'insert-text-symbolic',
    Color: 'color-select-symbolic',
};

function copyous() {
    const ext = Main.extensionManager.lookup(COPYOUS_UUID);
    return ext?.stateObj?.entryTracker ? ext.stateObj : null;
}

export function relativeTime(datetime) {
    if (!datetime)
        return '';
    const seconds = Math.max(0, GLib.DateTime.new_now_utc().difference(datetime) / 1e6);
    if (seconds < 60)
        return 'Just now';
    if (seconds < 3600)
        return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400)
        return `${Math.floor(seconds / 3600)} h ago`;
    return `${Math.floor(seconds / 86400)} d ago`;
}

export class ClipboardSearchProvider {
    constructor(isActive) {
        this.id = 'yags-clipboard';
        this.displayName = 'Clipboard';
        this.keyword = ':';
        this.isRemoteProvider = false;
        this.canLaunchSearch = false;
        this._isActive = isActive;
    }

    get available() {
        return copyous() !== null;
    }

    entry(id) {
        return copyous()?.entryTracker._entries.get(Number(id)) ?? null;
    }

    getInitialResultSet(terms) {
        const ext = copyous();
        const forced = terms[0]?.startsWith(this.keyword);
        if (!ext || !(this._isActive() || forced))
            return Promise.resolve([]);
        if (forced)
            terms = [terms[0].slice(this.keyword.length), ...terms.slice(1)].filter(Boolean);
        const lower = terms.map(t => t.toLowerCase());
        const entries = [...ext.entryTracker._entries.values()]
            .filter(e => {
                const hay = `${e.title ?? ''} ${e.content ?? ''}`.toLowerCase();
                return lower.every(t => hay.includes(t));
            })
            .sort((a, b) => (b.datetime?.to_unix() ?? 0) - (a.datetime?.to_unix() ?? 0))
            .slice(0, MAX_RESULTS);
        return Promise.resolve(entries.map(e => String(e.id)));
    }

    getSubsearchResultSet(_previous, terms) {
        return this.getInitialResultSet(terms);
    }

    filterResults(results, max) {
        return results.slice(0, max);
    }

    getResultMetas(ids) {
        return Promise.resolve(ids.map(id => {
            const e = this.entry(id);
            const text = (e?.title || e?.content || '').replace(/\s+/g, ' ').trim();
            return {
                id,
                name: text.length > 90 ? `${text.slice(0, 90)}…` : text || '(empty)',
                description: `${e?.type ?? ''} · ${relativeTime(e?.datetime)}`,
                createIcon: size => new St.Icon({
                    gicon: new Gio.ThemedIcon({name: TYPE_ICONS[e?.type] ?? 'edit-paste-symbolic'}),
                    icon_size: size,
                }),
            };
        }));
    }

    activateResult(id) {
        const ext = copyous();
        const e = this.entry(id);
        if (ext && e)
            ext.clipboardManager.copyEntry(e).catch(logError);
    }
}

// SPDX-License-Identifier: GPL-3.0-or-later
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const COPYOUS_UUID = 'copyous@boerdereinar.dev';
const MAX_RESULTS = 20;
const TYPE_ICONS = {
    Text: 'edit-paste-symbolic', Code: 'text-x-script-symbolic', Image: 'image-x-generic-symbolic',
    File: 'text-x-generic-symbolic', Files: 'folder-symbolic', Link: 'web-browser-symbolic',
    Character: 'insert-text-symbolic', Color: 'color-select-symbolic',
};

function copyous() {
    const ext = Main.extensionManager.lookup(COPYOUS_UUID);
    return ext?.stateObj?.entryTracker ? ext.stateObj : null;
}

function relativeTime(datetime) {
    if (!datetime)
        return '';
    const s = Math.max(0, GLib.DateTime.new_now_utc().difference(datetime) / 1e6);
    if (s < 60)
        return 'Just now';
    if (s < 3600)
        return `${Math.floor(s / 60)} min ago`;
    if (s < 86400)
        return `${Math.floor(s / 3600)} h ago`;
    return `${Math.floor(s / 86400)} d ago`;
}

export default class ClipboardPlugin {
    constructor(api) {
        this.api = api;
    }

    available() {
        return copyous() !== null;
    }

    query({query}) {
        const ext = copyous();
        if (!ext)
            return [];
        const words = query.toLowerCase().split(/\s+/).filter(Boolean);
        return [...ext.entryTracker._entries.values()]
            .filter(e => words.every(w => `${e.title ?? ''} ${e.content ?? ''}`.toLowerCase().includes(w)))
            .sort((a, b) => (b.datetime?.to_unix() ?? 0) - (a.datetime?.to_unix() ?? 0))
            .slice(0, MAX_RESULTS)
            .map(e => {
                const text = (e.title || e.content || '').replace(/\s+/g, ' ').trim();
                const when = relativeTime(e.datetime);
                return {
                    id: String(e.id),
                    title: text.length > 90 ? `${text.slice(0, 90)}…` : text || '(empty)',
                    subtitle: `${e.type ?? ''} · ${when}`,
                    icon: TYPE_ICONS[e.type] ?? 'edit-paste-symbolic',
                    kind: e.type ?? 'Clipboard',
                    copy: e.content ?? '',
                    run: () => ext.clipboardManager.copyEntry(e).catch(err => this.api.log(err.message)),
                    preview: {kind: e.type ?? 'Clipboard', code: (e.content ?? '').slice(0, 600), details: [['Copied', when]]},
                };
            });
    }
}

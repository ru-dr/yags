// SPDX-License-Identifier: GPL-3.0-or-later
import GLib from 'gi://GLib';

function rows(unixSeconds, withMs) {
    const dt = GLib.DateTime.new_from_unix_local(Math.floor(unixSeconds));
    const list = [
        [dt.format('%a %e %b %Y, %H:%M:%S %Z').replace(/\s+/g, ' '), 'Local time'],
        [dt.to_utc().format('%Y-%m-%dT%H:%M:%SZ'), 'ISO 8601 UTC'],
        [`${Math.floor(unixSeconds)}`, 'Unix seconds'],
    ];
    if (withMs)
        list.push([`${Date.now()}`, 'Unix milliseconds']);
    return list.map(([title, subtitle]) => ({
        title, subtitle, icon: 'x-office-calendar-symbolic', copy: title, activate: {copy: title},
        preview: {kind: subtitle, details: list.map(([v, k]) => [k, v])},
    }));
}

export default class TimePlugin {
    constructor(api) {
        this.api = api;
    }

    query({query}) {
        const low = query.toLowerCase();
        if (/^(now|time|date|unix|epoch|timestamp)$/.test(low))
            return rows(Date.now() / 1000, true);
        const m = /^(?:ts\s+)?(\d{10}|\d{13})$/.exec(low);
        if (m)
            return rows(m[1].length === 13 ? Number(m[1]) / 1000 : Number(m[1]), false);
        return [];
    }
}

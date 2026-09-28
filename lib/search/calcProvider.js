// SPDX-License-Identifier: GPL-3.0-or-later
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Soup from 'gi://Soup?version=3.0';
import St from 'gi://St';
import * as E from './calc/engine.js';
import * as Color from './calc/color.js';

Gio._promisify(Soup.Session.prototype, 'send_and_read_async');

const RATES_URL = 'https://open.er-api.com/v6/latest/USD';
const RATES_MAX_AGE_S = 12 * 3600;
const RETRY_AFTER_MS = 10 * 60 * 1000;
const RATES_FILE = GLib.build_filenamev([GLib.get_user_cache_dir(), 'yags', 'rates.json']);
const SYMBOLS = {'$': 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY', '₹': 'INR'};
const HASHES = {
    md5: GLib.ChecksumType.MD5, sha1: GLib.ChecksumType.SHA1, sha256: GLib.ChecksumType.SHA256,
    sha384: GLib.ChecksumType.SHA384, sha512: GLib.ChecksumType.SHA512,
};

class Rates {
    constructor() {
        this._rates = null;
        this._time = 0;
        this._pending = null;
        this._session = null;
        this._failedAt = 0;
        this._cancellable = new Gio.Cancellable();
        try {
            const [, bytes] = GLib.file_get_contents(RATES_FILE);
            const data = JSON.parse(new TextDecoder().decode(bytes));
            this._rates = data.rates;
            this._time = data.time;
        } catch {}
    }

    get stale() {
        return !this._rates || Date.now() / 1000 - this._time > RATES_MAX_AGE_S;
    }

    get updated() {
        return this._time;
    }

    async get() {
        if (this.stale && Date.now() - this._failedAt > RETRY_AFTER_MS)
            await (this._pending ??= this._fetch().finally(() => (this._pending = null)));
        return this._rates;
    }

    destroy() {
        this._cancellable.cancel();
        this._session?.abort();
    }

    async _fetch() {
        const cancellable = this._cancellable;
        try {
            this._session ??= new Soup.Session({timeout: 5});
            const msg = Soup.Message.new('GET', RATES_URL);
            const bytes = await this._session.send_and_read_async(msg, GLib.PRIORITY_DEFAULT, cancellable);
            if (msg.get_status() !== 200 || !bytes) {
                this._failedAt = Date.now();
                return;
            }
            const data = JSON.parse(new TextDecoder().decode(bytes.get_data()));
            if (data.result !== 'success' || !data.rates) {
                this._failedAt = Date.now();
                return;
            }
            this._rates = data.rates;
            this._time = data.time_last_update_unix ?? Math.floor(Date.now() / 1000);
            GLib.mkdir_with_parents(GLib.path_get_dirname(RATES_FILE), 0o755);
            GLib.file_set_contents(RATES_FILE, JSON.stringify({time: this._time, rates: this._rates}));
        } catch {
            if (!cancellable.is_cancelled())
                this._failedAt = Date.now();
        }
    }
}

function currencyCode(name, rates) {
    const code = SYMBOLS[name] ?? name.toUpperCase();
    return rates && code in rates ? code : null;
}

function randomPassword(len) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_=+';
    let out = '';
    for (let i = 0; i < len; i++)
        out += chars[GLib.random_int_range(0, chars.length)];
    return out;
}

function dateRows(unixSeconds) {
    const dt = GLib.DateTime.new_from_unix_local(Math.floor(unixSeconds));
    const utc = dt.to_utc();
    return [
        {name: dt.format('%a %e %b %Y, %H:%M:%S %Z').replace(/\s+/g, ' '), description: 'Local time'},
        {name: utc.format('%Y-%m-%dT%H:%M:%SZ'), description: 'ISO 8601 UTC'},
        {name: `${Math.floor(unixSeconds)}`, description: 'Unix seconds'},
    ];
}

export class CalcSearchProvider {
    constructor(settings) {
        this._settings = settings;
        this.id = 'yags-calc';
        this.displayName = 'Calculator';
        this.keyword = '=';
        this.isRemoteProvider = false;
        this.canLaunchSearch = false;
        this._rates = new Rates();
        this._items = new Map();
    }

    async getInitialResultSet(terms, cancellable) {
        let q = terms.join(' ').trim();
        const forced = q.startsWith('=');
        if (forced)
            q = q.slice(1).trim();
        if (!q)
            return [];
        let rows = this._color(q) ?? this._generators(q) ?? await this._convert(q, cancellable) ??
            this._math(q, forced) ?? [];
        rows = rows.filter(r => r && typeof r.name === 'string' && r.name !== '');
        this._items.clear();
        return rows.map((row, i) => {
            const id = `calc:${i}:${row.name}:${row.description ?? ''}`;
            this._items.set(id, row);
            return id;
        });
    }

    destroy() {
        this._rates.destroy();
        this._items.clear();
    }

    getSubsearchResultSet(_previous, terms, cancellable) {
        return this.getInitialResultSet(terms, cancellable);
    }

    filterResults(results, max) {
        return results.slice(0, max);
    }

    getResultMetas(ids) {
        return Promise.resolve(ids.map(id => {
            const row = this._items.get(id) ?? {name: '', description: ''};
            return {
                id,
                name: row.name,
                description: row.description ?? '',
                clipboardText: row.copy ?? row.name,
                createIcon: size => row.color
                    ? new St.Widget({
                        style: `background-color: ${row.color}; border-radius: ${Math.round(size / 4)}px;`,
                        width: size, height: size,
                    })
                    : new St.Icon({
                        gicon: new Gio.ThemedIcon({name: row.icon ?? 'accessories-calculator-symbolic'}),
                        icon_size: size,
                    }),
            };
        }));
    }

    activateResult(id) {
        const row = this._items.get(id);
        if (row)
            St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, row.copy ?? row.name);
    }

    _math(q, forced) {
        if (!forced && !E.looksLikeMath(q))
            return null;
        let result;
        try {
            result = E.evaluate(q);
        } catch (e) {
            return forced ? [{name: 'Invalid expression', description: e.message, icon: 'dialog-warning-symbolic', copy: ''}] : null;
        }
        const {value, usedBase, usedBitwise} = result;
        const rows = [{name: E.formatNumber(value), description: `${q} =`, copy: E.formatNumber(value)}];
        if ((usedBase || usedBitwise) && Number.isInteger(value) && Number.isFinite(value)) {
            for (const [base, label] of [[16, 'Hex'], [2, 'Binary'], [8, 'Octal']]) {
                const text = E.toBase(value, base);
                rows.push({name: text, description: label, copy: text.replace(/ /g, ''), icon: 'utilities-terminal-symbolic'});
            }
        }
        return rows;
    }

    async _convert(q, cancellable) {
        const base = E.BASE_CONVERSION.exec(q);
        if (base) {
            try {
                const {value} = E.evaluate(base[1]);
                const text = E.toBase(value, E.baseOf(base[2]));
                return [{name: text, description: `${base[1]} in ${base[2]}`, copy: text.replace(/ /g, ''), icon: 'utilities-terminal-symbolic'}];
            } catch {
                return null;
            }
        }

        const m = E.CONVERSION.exec(q) ?? /^\s*(.+?)\s*([a-zA-Z$€£¥₹]{1,3})\s*$/.exec(q);
        if (!m)
            return null;
        let amount;
        try {
            amount = E.evaluate(m[1]).value;
        } catch {
            return null;
        }
        const [, , from, to] = m;

        if (to) {
            const unit = E.convertUnits(amount, from, to);
            if (unit) {
                const text = E.formatGrouped(unit.value, 6);
                return [{
                    name: `${text} ${unit.to}`,
                    description: `${E.formatGrouped(amount, 6)} ${unit.from} = ${text} ${unit.to} · ${unit.category}`,
                    copy: E.formatNumber(Number(unit.value.toPrecision(12))),
                    icon: 'accessories-calculator-symbolic',
                }];
            }
        }

        if (!this._settings.get_boolean('feature-currency'))
            return null;
        if (!currencyCode(from, {USD: 1, EUR: 1, GBP: 1}) && !/^[a-zA-Z]{3}$/.test(from) && !SYMBOLS[from])
            return null;
        if (to && !/^[a-zA-Z]{3}$/.test(to) && !SYMBOLS[to])
            return null;
        const rates = await this._rates.get();
        if (cancellable?.is_cancelled())
            return null;
        const src = currencyCode(from, rates);
        const dests = to
            ? [currencyCode(to, rates)]
            : this._settings.get_strv('currencies').map(c => currencyCode(c, rates)).filter(c => c && c !== src);
        if (!src || dests.some(d => !d) || dests.length === 0)
            return null;
        const when = GLib.DateTime.new_from_unix_local(this._rates.updated).format('%e %b').trim();
        return dests.map(dest => {
            const value = amount / rates[src] * rates[dest];
            const text = value.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
            return {
                name: `${text} ${dest}`,
                description: `${E.formatGrouped(amount, 2)} ${src} · rate ${(rates[dest] / rates[src]).toPrecision(6)} · ${when}`,
                copy: value.toFixed(2),
                icon: 'accessories-calculator-symbolic',
            };
        });
    }

    _color(q) {
        if (!/^(#|rgba?\(|hsla?\()/i.test(q.trim()))
            return null;
        const c = Color.parseColor(q);
        if (!c)
            return null;
        const hex = Color.toHex({...c, a: 1});
        return Color.colorFormats(c).map(([kind, value]) => ({
            name: value,
            description: kind,
            color: hex,
            rgba: c,
            copy: value,
        }));
    }

    row(id) {
        return this._items.get(id) ?? null;
    }

    _generators(q) {
        const low = q.toLowerCase();
        let m;
        if (/^(uuid|guid)$/.test(low)) {
            const u = GLib.uuid_string_random();
            return [{name: u, description: 'UUID v4'}, {name: u.toUpperCase(), description: 'UUID v4, uppercase'}];
        }
        if ((m = /^(md5|sha1|sha256|sha384|sha512)\s+(.+)$/is.exec(q)))
            return [{name: GLib.compute_checksum_for_string(HASHES[m[1].toLowerCase()], m[2], -1), description: `${m[1].toUpperCase()} of "${m[2]}"`, icon: 'dialog-password-symbolic'}];
        if ((m = /^(base64d|b64d|unbase64|base64 -d)\s+(.+)$/is.exec(q))) {
            try {
                const text = new TextDecoder('utf-8', {fatal: true}).decode(GLib.base64_decode(m[2].trim()));
                return [{name: text, description: 'Base64 decoded', icon: 'text-x-generic-symbolic'}];
            } catch {
                return [{name: 'Not valid Base64', description: m[2], icon: 'dialog-warning-symbolic', copy: ''}];
            }
        }
        if ((m = /^(base64|b64)\s+(.+)$/is.exec(q)))
            return [{name: GLib.base64_encode(new TextEncoder().encode(m[2])), description: 'Base64 encoded', icon: 'text-x-generic-symbolic'}];
        if ((m = /^(urldecode|unurl)\s+(.+)$/is.exec(q)))
            return [{name: GLib.uri_unescape_string(m[2], null) ?? m[2], description: 'URL decoded', icon: 'web-browser-symbolic'}];
        if ((m = /^(url|urlencode)\s+(.+)$/is.exec(q)))
            return [{name: GLib.uri_escape_string(m[2], null, false), description: 'URL encoded', icon: 'web-browser-symbolic'}];
        if (/^(now|time|date|unix|epoch|timestamp)$/.test(low))
            return dateRows(Date.now() / 1000).concat([{name: `${Date.now()}`, description: 'Unix milliseconds'}])
                .map(r => ({...r, icon: 'x-office-calendar-symbolic'}));
        if ((m = /^(?:ts\s+)?(\d{10}|\d{13})$/.exec(low)))
            return dateRows(m[1].length === 13 ? Number(m[1]) / 1000 : Number(m[1])).map(r => ({...r, icon: 'x-office-calendar-symbolic'}));
        if ((m = /^(?:random|rand)(?:\s+(-?\d+)(?:\s+(-?\d+))?)?$/.exec(low))) {
            const clamp = n => Math.max(-2147483647, Math.min(2147483646, n));
            const lo = clamp(m[2] !== undefined ? Number(m[1]) : 1);
            const hi = clamp(m[2] !== undefined ? Number(m[2]) : m[1] !== undefined ? Number(m[1]) : 100);
            return [{name: `${GLib.random_int_range(Math.min(lo, hi), Math.max(lo, hi) + 1)}`, description: `Random number ${Math.min(lo, hi)} to ${Math.max(lo, hi)}`, icon: 'media-playlist-shuffle-symbolic'}];
        }
        if ((m = /^(?:password|pwgen|pass)(?:\s+(\d+))?$/.exec(low))) {
            const len = Math.min(128, Math.max(4, Number(m[1] ?? 20)));
            return [{name: randomPassword(len), description: `Random password, ${len} characters`, icon: 'dialog-password-symbolic'}];
        }
        return null;
    }
}

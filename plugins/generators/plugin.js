// SPDX-License-Identifier: GPL-3.0-or-later
import GLib from 'gi://GLib';

const HASHES = {
    md5: GLib.ChecksumType.MD5, sha1: GLib.ChecksumType.SHA1, sha256: GLib.ChecksumType.SHA256,
    sha384: GLib.ChecksumType.SHA384, sha512: GLib.ChecksumType.SHA512,
};

function randomPassword(len) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_=+';
    let out = '';
    for (let i = 0; i < len; i++)
        out += chars[GLib.random_int_range(0, chars.length)];
    return out;
}

function row(title, subtitle, icon) {
    return {title, subtitle, icon, copy: title, activate: {copy: title}, preview: {kind: subtitle, code: title}};
}

export default class GeneratorsPlugin {
    constructor(api) {
        this.api = api;
    }

    query({query}) {
        const q = query;
        const low = q.toLowerCase();
        let m;
        if (/^(uuid|guid)$/.test(low)) {
            const u = GLib.uuid_string_random();
            return [row(u, 'UUID v4', 'dialog-password-symbolic'), row(u.toUpperCase(), 'UUID v4, uppercase', 'dialog-password-symbolic')];
        }
        if ((m = /^(md5|sha1|sha256|sha384|sha512)\s+(.+)$/is.exec(q)))
            return [row(GLib.compute_checksum_for_string(HASHES[m[1].toLowerCase()], m[2], -1), `${m[1].toUpperCase()} of "${m[2]}"`, 'dialog-password-symbolic')];
        if ((m = /^(base64d|b64d|unbase64|base64 -d)\s+(.+)$/is.exec(q))) {
            try {
                const text = new TextDecoder('utf-8', {fatal: true}).decode(GLib.base64_decode(m[2].trim()));
                return text ? [row(text, 'Base64 decoded', 'text-x-generic-symbolic')] : [];
            } catch {
                return [{title: 'Not valid Base64', subtitle: m[2], icon: 'dialog-warning-symbolic'}];
            }
        }
        if ((m = /^(base64|b64)\s+(.+)$/is.exec(q)))
            return [row(GLib.base64_encode(new TextEncoder().encode(m[2])), 'Base64 encoded', 'text-x-generic-symbolic')];
        if ((m = /^(urldecode|unurl)\s+(.+)$/is.exec(q)))
            return [row(GLib.uri_unescape_string(m[2], null) ?? m[2], 'URL decoded', 'web-browser-symbolic')];
        if ((m = /^(url|urlencode)\s+(.+)$/is.exec(q)))
            return [row(GLib.uri_escape_string(m[2], null, false), 'URL encoded', 'web-browser-symbolic')];
        if ((m = /^(?:random|rand)(?:\s+(-?\d+)(?:\s+(-?\d+))?)?$/.exec(low))) {
            const clamp = n => Math.max(-2147483647, Math.min(2147483646, n));
            const lo = clamp(m[2] !== undefined ? Number(m[1]) : 1);
            const hi = clamp(m[2] !== undefined ? Number(m[2]) : m[1] !== undefined ? Number(m[1]) : 100);
            const [a, b] = [Math.min(lo, hi), Math.max(lo, hi)];
            return [row(`${GLib.random_int_range(a, b + 1)}`, `Random number ${a} to ${b}`, 'media-playlist-shuffle-symbolic')];
        }
        if ((m = /^(?:password|pwgen|pass)(?:\s+(\d+))?$/.exec(low))) {
            const len = Math.min(128, Math.max(4, Number(m[1] ?? 20)));
            return [row(randomPassword(len), `Random password, ${len} characters`, 'dialog-password-symbolic')];
        }
        return [];
    }
}

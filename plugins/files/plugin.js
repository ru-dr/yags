// SPDX-License-Identifier: GPL-3.0-or-later
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import St from 'gi://St';

Gio._promisify(Gio.Subprocess.prototype, 'communicate_utf8_async');

const HOME = GLib.get_home_dir();
const MAX_CANDIDATES = 50000;
const FRESH_TTL_US = 30 * 1000 * 1000;
const MAX_RESULTS = 20;
const SKIP_SEGMENTS = new Set(['node_modules', '__pycache__', 'site-packages', 'dist-packages', 'vendor', 'target', 'venv', 'Trash']);
const FAVORED_DIRS = new Set(['Desktop', 'Documents', 'Downloads', 'Pictures', 'Music', 'Videos']);
const RECENT_FILE = GLib.build_filenamev([GLib.get_user_data_dir(), 'recently-used.xbel']);
const PREVIEW_ATTRS = 'standard::content-type,standard::size,standard::type,time::modified,thumbnail::path';

function tildify(path) {
    return path.startsWith(HOME) ? `~${path.slice(HOME.length)}` : path;
}

class RecentFiles {
    constructor() {
        this._mtime = 0;
        this._paths = [];
    }

    get paths() {
        const file = Gio.File.new_for_path(RECENT_FILE);
        let mtime;
        try {
            mtime = file.query_info('time::modified', Gio.FileQueryInfoFlags.NONE, null).get_attribute_uint64('time::modified');
        } catch {
            return this._paths;
        }
        if (mtime === this._mtime)
            return this._paths;
        this._mtime = mtime;
        const [, bytes] = file.load_contents(null);
        const found = [];
        for (const m of new TextDecoder().decode(bytes).matchAll(/<bookmark href="file:\/\/([^"]+)"/g)) {
            try {
                found.push(decodeURIComponent(m[1]));
            } catch {}
        }
        this._paths = found.reverse();
        return this._paths;
    }
}

class FreshFiles {
    constructor() {
        this._time = 0;
        this._paths = [];
    }

    get paths() {
        const now = GLib.get_monotonic_time();
        if (now - this._time < FRESH_TTL_US)
            return this._paths;
        this._time = now;
        const found = [];
        const list = dir => {
            try {
                const it = Gio.File.new_for_path(dir).enumerate_children('standard::name', Gio.FileQueryInfoFlags.NONE, null);
                let info;
                while ((info = it.next_file(null)) !== null) {
                    if (!info.get_name().startsWith('.'))
                        found.push(GLib.build_filenamev([dir, info.get_name()]));
                }
                it.close(null);
            } catch {}
        };
        list(HOME);
        for (const dir of FAVORED_DIRS)
            list(GLib.build_filenamev([HOME, dir]));
        this._paths = found;
        return found;
    }
}

function isNoise(path, excluded) {
    const rel = path.slice(HOME.length + 1);
    if (excluded.some(part => `/${rel}/`.includes(part)))
        return true;
    return rel.split('/').some(seg => seg.startsWith('.') || SKIP_SEGMENTS.has(seg));
}

function matchClass(name, query) {
    const stem = name.replace(/\.[^.]+$/, '');
    if (name === query || stem === query)
        return 0;
    if (name.startsWith(query))
        return 1;
    if (new RegExp(`[\\s_.-]${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(name))
        return 2;
    return 3;
}

function preview(path) {
    const details = [];
    let kind = 'File';
    let image = null;
    try {
        const info = Gio.File.new_for_path(path).query_info(PREVIEW_ATTRS, Gio.FileQueryInfoFlags.NONE, null);
        const isDir = info.get_file_type() === Gio.FileType.DIRECTORY;
        kind = isDir ? 'Folder' : Gio.content_type_get_description(info.get_content_type());
        const thumb = info.get_attribute_byte_string('thumbnail::path');
        if (thumb && GLib.file_test(thumb, GLib.FileTest.EXISTS))
            image = thumb;
        if (!isDir)
            details.push(['Size', GLib.format_size(info.get_size())]);
        details.push(['Modified', GLib.DateTime.new_from_unix_local(info.get_modification_date_time().to_unix()).format('%e %b %Y, %H:%M').trim()]);
    } catch {}
    details.push(['Where', tildify(GLib.path_get_dirname(path))]);
    return {kind, image, details};
}

export default class FilesPlugin {
    constructor(api) {
        this.api = api;
        this._plocate = GLib.find_program_in_path('plocate');
        this._recent = new RecentFiles();
        this._fresh = new FreshFiles();
    }

    async _locate(terms, cancellable) {
        if (!this._plocate)
            return [];
        const proc = Gio.Subprocess.new([this._plocate, '-i', '-b', '-l', `${MAX_CANDIDATES}`, '--', ...terms],
            Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE);
        try {
            const [stdout] = await proc.communicate_utf8_async(null, cancellable);
            return stdout ? stdout.split('\n') : [];
        } catch (e) {
            proc.force_exit();
            throw e;
        }
    }

    async query({query, cancellable}) {
        const clean = query.split(/\s+/).map(t => t.replace(/[*?[\]\\]/g, '')).filter(Boolean);
        if (clean.join(' ').length < 2)
            return [];
        const excluded = this.api.settings.get('exclude-paths');
        const lower = clean.map(t => t.toLowerCase());
        const recent = this._recent.paths;
        const recentRank = new Map(recent.map((p, i) => [p, i]));
        const candidates = new Set(await this._locate(clean, cancellable));
        for (const p of [...recent, ...this._fresh.paths]) {
            const name = GLib.path_get_basename(p).toLowerCase();
            if (lower.every(t => name.includes(t)))
                candidates.add(p);
        }
        const scored = [];
        for (const path of candidates) {
            if (!path.startsWith(`${HOME}/`) || isNoise(path, excluded))
                continue;
            const name = GLib.path_get_basename(path).toLowerCase();
            const rel = path.slice(HOME.length + 1);
            const depth = rel.split('/').length;
            let score = matchClass(name, lower[0]) * 1000 + depth * 25 + name.length;
            if (recentRank.has(path))
                score -= 900 - Math.min(recentRank.get(path), 400);
            if (depth === 1 || FAVORED_DIRS.has(rel.split('/')[0]))
                score -= 60;
            scored.push([score, path]);
        }
        scored.sort((a, b) => a[0] - b[0]);
        const rows = [];
        for (const [, path] of scored) {
            if (rows.length >= MAX_RESULTS)
                break;
            if (!GLib.file_test(path, GLib.FileTest.EXISTS))
                continue;
            const isDir = GLib.file_test(path, GLib.FileTest.IS_DIR);
            rows.push({
                id: path,
                title: GLib.path_get_basename(path),
                subtitle: tildify(GLib.path_get_dirname(path)),
                icon: size => {
                    let gicon = null;
                    try {
                        gicon = Gio.File.new_for_path(path).query_info('standard::icon', Gio.FileQueryInfoFlags.NONE, null).get_icon();
                    } catch {}
                    return new St.Icon({gicon: gicon ?? new Gio.ThemedIcon({name: 'text-x-generic'}), icon_size: size});
                },
                kind: isDir ? 'Folder' : 'File',
                path,
                bookmark: path,
                copy: path,
                activate: {open: path},
                preview: () => preview(path),
            });
        }
        return rows;
    }
}

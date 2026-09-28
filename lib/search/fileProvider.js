// SPDX-License-Identifier: GPL-3.0-or-later
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import St from 'gi://St';

Gio._promisify(Gio.Subprocess.prototype, 'communicate_utf8_async');

const HOME = GLib.get_home_dir();
const MAX_CANDIDATES = 50000;
const FRESH_TTL_US = 30 * 1000 * 1000;
const MAX_RESULTS = 20;
const SKIP_SEGMENTS = new Set([
    'node_modules', '__pycache__', 'site-packages', 'dist-packages',
    'vendor', 'target', 'venv', 'Trash',
]);
const FAVORED_DIRS = new Set([
    'Desktop', 'Documents', 'Downloads', 'Pictures', 'Music', 'Videos',
]);
const RECENT_FILE = GLib.build_filenamev([GLib.get_user_data_dir(), 'recently-used.xbel']);

class RecentFiles {
    constructor() {
        this._mtime = 0;
        this._paths = [];
    }

    get paths() {
        const file = Gio.File.new_for_path(RECENT_FILE);
        let mtime = 0;
        try {
            mtime = file.query_info('time::modified', Gio.FileQueryInfoFlags.NONE, null)
                .get_attribute_uint64('time::modified');
        } catch {
            return this._paths;
        }
        if (mtime === this._mtime)
            return this._paths;
        this._mtime = mtime;

        const [, bytes] = file.load_contents(null);
        const text = new TextDecoder().decode(bytes);
        const found = [];
        for (const match of text.matchAll(/<bookmark href="file:\/\/([^"]+)"/g)) {
            try {
                found.push(decodeURIComponent(match[1]));
            } catch {}
        }
        this._paths = found.reverse();
        return this._paths;
    }
}

function isNoise(path, excluded) {
    const rel = path.slice(HOME.length + 1);
    if (excluded.some(part => `/${rel}/`.includes(part)))
        return true;
    return rel.split('/').some(seg => seg.startsWith('.') || SKIP_SEGMENTS.has(seg));
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
                const it = Gio.File.new_for_path(dir).enumerate_children(
                    'standard::name', Gio.FileQueryInfoFlags.NONE, null);
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

export class FileSearchProvider {
    constructor(settings) {
        this._settings = settings;
        this.id = 'yags-files';
        this.displayName = 'Files';
        this.isRemoteProvider = false;
        this.canLaunchSearch = false;
        this._plocate = GLib.find_program_in_path('plocate');
        this._recent = new RecentFiles();
        this._fresh = new FreshFiles();
    }

    async _locate(terms, cancellable) {
        if (!this._plocate)
            return [];
        const proc = Gio.Subprocess.new(
            [this._plocate, '-i', '-b', '-l', `${MAX_CANDIDATES}`, '--', ...terms],
            Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE);
        const [stdout] = await proc.communicate_utf8_async(null, cancellable);
        return stdout ? stdout.split('\n') : [];
    }

    async getInitialResultSet(terms, cancellable) {
        const clean = terms.map(t => t.replace(/[*?[\]\\]/g, '')).filter(t => t.length > 0);
        const query = clean.join(' ').toLowerCase();
        if (query.length < 2 || !this._settings.get_boolean('feature-file-search'))
            return [];
        const excluded = this._settings.get_strv('exclude-paths');

        const lowerTerms = clean.map(t => t.toLowerCase());
        const recent = this._recent.paths;
        const recentRank = new Map(recent.map((p, i) => [p, i]));
        const candidates = new Set(await this._locate(clean, cancellable));
        for (const p of [...recent, ...this._fresh.paths]) {
            const name = GLib.path_get_basename(p).toLowerCase();
            if (lowerTerms.every(t => name.includes(t)))
                candidates.add(p);
        }

        const scored = [];
        for (const path of candidates) {
            if (!path.startsWith(`${HOME}/`) || isNoise(path, excluded))
                continue;
            const name = GLib.path_get_basename(path).toLowerCase();
            const rel = path.slice(HOME.length + 1);
            const depth = rel.split('/').length;
            let score = matchClass(name, lowerTerms[0]) * 1000 + depth * 25 + name.length;
            if (recentRank.has(path))
                score -= 900 - Math.min(recentRank.get(path), 400);
            if (depth === 1 || FAVORED_DIRS.has(rel.split('/')[0]))
                score -= 60;
            scored.push([score, path]);
        }
        scored.sort((a, b) => a[0] - b[0]);

        const results = [];
        for (const [, path] of scored) {
            if (results.length >= MAX_RESULTS)
                break;
            if (GLib.file_test(path, GLib.FileTest.EXISTS))
                results.push(path);
        }
        return results;
    }

    getSubsearchResultSet(_previous, terms, cancellable) {
        return this.getInitialResultSet(terms, cancellable);
    }

    filterResults(results, max) {
        return results.slice(0, max);
    }

    getResultMetas(ids) {
        return Promise.resolve(ids.map(path => {
            let gicon = null;
            try {
                gicon = Gio.File.new_for_path(path)
                    .query_info('standard::icon', Gio.FileQueryInfoFlags.NONE, null)
                    .get_icon();
            } catch {}
            const dir = GLib.path_get_dirname(path);
            return {
                id: path,
                name: GLib.path_get_basename(path),
                description: dir.startsWith(HOME) ? `~${dir.slice(HOME.length)}` : dir,
                createIcon: size => new St.Icon({
                    gicon: gicon ?? new Gio.ThemedIcon({name: 'text-x-generic'}),
                    icon_size: size,
                }),
            };
        }));
    }

    activateResult(path) {
        Gio.AppInfo.launch_default_for_uri(
            GLib.filename_to_uri(path, null),
            global.create_app_launch_context(0, -1));
    }
}

// SPDX-License-Identifier: GPL-3.0-or-later
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Bookmarks from '../core/bookmarks.js';

const URL_LIKE = Bookmarks.URL_LIKE;

Gio._promisify(Gio.InputStream.prototype, 'read_bytes_async');
Gio._promisify(Gio.Subprocess.prototype, 'wait_async');

const HOME = GLib.get_home_dir();
const PREVIEW_TIMEOUT_MS = 2000;
const PREVIEW_MAX_CHARS = 6000;
const PREVIEW_UNSAFE_CHARS = /[;|&<>`$\\(){}[\]*?=!#%^]/;
const PREVIEW_UNSAFE_ARG = /^(-o|--output|--files0-from|--exec|-exec|--config|-c)/;
const PREVIEW_READ_CHUNK = 4096;
const TERMINALS = [
    ['ptyxis', cmd => ['ptyxis', '--new-window', '--', ...cmd]],
    ['kgx', cmd => ['kgx', '--', ...cmd]],
    ['gnome-terminal', cmd => ['gnome-terminal', '--', ...cmd]],
    ['kitty', cmd => ['kitty', ...cmd]],
    ['alacritty', cmd => ['alacritty', '-e', ...cmd]],
    ['foot', cmd => ['foot', ...cmd]],
    ['wezterm', cmd => ['wezterm', 'start', '--', ...cmd]],
    ['konsole', cmd => ['konsole', '-e', ...cmd]],
    ['xterm', cmd => ['xterm', '-e', ...cmd]],
];

function stripKeyword(terms, keyword) {
    const q = terms.join(' ').trim();
    if (keyword && q.startsWith(keyword) && !(keyword === '?' && q.startsWith('??')))
        return {q: q.slice(keyword.length).trim(), forced: true};
    return {q, forced: false};
}

function icon(name) {
    return size => new St.Icon({gicon: new Gio.ThemedIcon({name}), icon_size: size});
}

function openUri(uri) {
    Gio.AppInfo.launch_default_for_uri(uri, global.create_app_launch_context(0, -1));
}

function userShell() {
    return GLib.getenv('SHELL') || '/bin/sh';
}

export function findTerminal(settings) {
    const wanted = settings.get_string('terminal');
    for (const [name, build] of TERMINALS) {
        if ((!wanted || wanted === name) && GLib.find_program_in_path(name))
            return {name, build};
    }
    if (wanted && GLib.find_program_in_path(wanted))
        return {name: wanted, build: cmd => [wanted, '-e', ...cmd]};
    return null;
}

export function runInTerminal(settings, command) {
    const shell = userShell();
    const term = findTerminal(settings);
    const inner = [shell, '-c', `cd ~; ${command}; printf '\\n[exit %s] ' "$?"; exec ${shell}`];
    GLib.spawn_async(HOME, term ? term.build(inner) : inner, null, GLib.SpawnFlags.SEARCH_PATH, null);
}

function runInBackground(command) {
    GLib.spawn_async(HOME, [userShell(), '-c', command], null, GLib.SpawnFlags.SEARCH_PATH, null);
}

class BaseProvider {
    constructor(settings, id, displayName, keyword) {
        this._settings = settings;
        this.id = id;
        this.displayName = displayName;
        this.keyword = keyword;
        this.isRemoteProvider = false;
        this.canLaunchSearch = false;
        this._items = new Map();
    }

    getSubsearchResultSet(_previous, terms, cancellable) {
        return this.getInitialResultSet(terms, cancellable);
    }

    filterResults(results, max) {
        return results.slice(0, max);
    }

    row(id) {
        return this._items.get(id) ?? null;
    }

    _store(rows) {
        this._items.clear();
        return rows.map(row => {
            this._items.set(row.id, row);
            return row.id;
        });
    }

    getResultMetas(ids) {
        return Promise.resolve(ids.map(id => {
            const row = this._items.get(id) ?? {name: '', description: ''};
            return {
                id,
                name: row.name,
                description: row.description,
                clipboardText: row.copy,
                createIcon: row.createIcon ?? icon(row.icon ?? 'system-run-symbolic'),
            };
        }));
    }

    activateResult(id) {
        this._items.get(id)?.run?.();
    }
}

export class WindowsSearchProvider extends BaseProvider {
    constructor(settings) {
        super(settings, 'yags-windows', 'Windows', '<');
    }

    getInitialResultSet(terms) {
        const {q, forced} = stripKeyword(terms, this.keyword);
        if (!forced && q.length < 2)
            return Promise.resolve([]);
        const words = q.toLowerCase().split(/\s+/).filter(Boolean);
        const tracker = Shell.WindowTracker.get_default();
        const rows = [];
        for (const win of global.display.get_tab_list(Meta.TabList.NORMAL_ALL, null)) {
            const app = tracker.get_window_app(win);
            const title = win.get_title() ?? '';
            const appName = app?.get_name() ?? '';
            if (!words.every(w => `${title} ${appName}`.toLowerCase().includes(w)))
                continue;
            const ws = win.get_workspace();
            rows.push({
                id: `win:${win.get_stable_sequence()}:${title}`,
                name: title || appName,
                description: `${appName}${ws ? ` · Workspace ${ws.index() + 1}` : ''} · Switch to window`,
                createIcon: app ? size => app.create_icon_texture(size) : icon('focus-windows-symbolic'),
                run: () => Main.activateWindow(win),
            });
        }
        return Promise.resolve(this._store(rows));
    }
}

export class ShellSearchProvider extends BaseProvider {
    constructor(settings) {
        super(settings, 'yags-shell', 'Shell', '>');
    }

    _previewArgv(command) {
        if (PREVIEW_UNSAFE_CHARS.test(command) || /\bsudo\b/.test(command))
            return null;
        let argv;
        try {
            [, argv] = GLib.shell_parse_argv(command);
        } catch {
            return null;
        }
        if (argv.slice(1).some(a => PREVIEW_UNSAFE_ARG.test(a)))
            return null;
        const allowed = this._settings.get_strv('shell-preview-commands');
        const ok = allowed.some(entry => {
            const parts = entry.split(/\s+/).filter(Boolean);
            return parts.length > 0 && parts.every((p, i) => argv[i] === p);
        });
        if (!ok || !GLib.find_program_in_path(argv[0]))
            return null;
        return argv.map(a => a.replace(/^~(?=\/|$)/, HOME));
    }

    async _capture(argv, cancellable) {
        const launcher = new Gio.SubprocessLauncher({
            flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_MERGE,
        });
        launcher.set_cwd(HOME);
        let proc;
        try {
            proc = launcher.spawnv(argv);
        } catch (e) {
            return {output: e.message, status: -1};
        }
        const stop = new Gio.Cancellable();
        const killId = cancellable?.connect(() => stop.cancel()) ?? 0;
        let timedOut = false;
        let timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, PREVIEW_TIMEOUT_MS, () => {
            timeoutId = 0;
            timedOut = true;
            stop.cancel();
            return GLib.SOURCE_REMOVE;
        });
        const stream = proc.get_stdout_pipe();
        const chunks = [];
        let size = 0;
        let output = '';
        let truncated = false;
        let finished = false;
        try {
            for (;;) {
                const bytes = await stream.read_bytes_async(PREVIEW_READ_CHUNK, GLib.PRIORITY_DEFAULT, stop);
                if (bytes.get_size() === 0) {
                    finished = true;
                    break;
                }
                chunks.push(bytes.toArray());
                size += bytes.get_size();
                if (size >= PREVIEW_MAX_CHARS) {
                    truncated = true;
                    break;
                }
            }
        } catch (e) {
            if (!stop.is_cancelled())
                output += `${output ? '\n' : ''}${e.message}`;
        } finally {
            if (timeoutId)
                GLib.source_remove(timeoutId);
            if (killId)
                cancellable.disconnect(killId);
            if (!finished)
                proc.force_exit();
            stream.close_async(GLib.PRIORITY_DEFAULT, null, null);
        }
        const all = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) {
            all.set(chunk, offset);
            offset += chunk.length;
        }
        output = new TextDecoder().decode(all) + output;
        let status = -1;
        if (finished) {
            try {
                await proc.wait_async(null);
                status = proc.get_if_exited() ? proc.get_exit_status() : -1;
            } catch {}
        }
        if (cancellable?.is_cancelled())
            return null;
        if (truncated)
            output = `${output.slice(0, PREVIEW_MAX_CHARS)}\n… output cut at ${PREVIEW_MAX_CHARS} characters`;
        else if (timedOut)
            output += `\n(stopped after ${PREVIEW_TIMEOUT_MS / 1000}s)`;
        return {output, status};
    }

    async getInitialResultSet(terms, cancellable) {
        const {q, forced} = stripKeyword(terms, this.keyword);
        if (!forced || !q)
            return this._store([]);
        const term = findTerminal(this._settings);
        let preview = null;
        const argv = this._settings.get_boolean('feature-shell-preview') ? this._previewArgv(q) : null;
        if (argv) {
            preview = await this._capture(argv, cancellable);
            if (!preview)
                return [];
        }
        const output = preview?.output.slice(0, PREVIEW_MAX_CHARS).replace(/\s+$/, '') ?? null;
        const first = output?.split('\n').find(l => l.trim()) ?? '';
        const rows = [{
            id: `sh:term:${q}:${first}`,
            name: q,
            description: output !== null
                ? (first || '(no output)')
                : `Enter to run in ${term?.name ?? 'a shell'}`,
            icon: 'utilities-terminal-symbolic',
            copy: q,
            output,
            status: preview?.status,
            run: () => runInTerminal(this._settings, q),
        }];
        if (output)
            rows.push({id: `sh:copy:${q}:${first}`, name: 'Copy output', description: `${output.split('\n').length} lines`, icon: 'edit-copy-symbolic', output, copy: output, run: () => St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, output)});
        rows.push({id: `sh:bg:${q}`, name: q, description: 'Run in the background, no window', icon: 'system-run-symbolic', copy: q, run: () => runInBackground(q)});
        return this._store(rows);
    }
}

export class WebSearchProvider extends BaseProvider {
    constructor(settings) {
        super(settings, 'yags-web', 'Web', '??');
    }

    _engines() {
        return this._settings.get_strv('web-shortcuts').map(line => {
            const [key, name, url] = line.split('|');
            return key && name && url ? {key: key.toLowerCase(), name, url} : null;
        }).filter(Boolean);
    }

    _searchRow(name, url, q) {
        const target = url.replace('%s', GLib.uri_escape_string(q, null, false));
        return {id: `web:${name}:${q}`, name: q, description: `Search ${name}`, icon: 'system-search-symbolic', copy: target, run: () => openUri(target)};
    }

    getInitialResultSet(terms) {
        const {q, forced} = stripKeyword(terms, this.keyword);
        if (!q)
            return Promise.resolve(this._store([]));
        const rows = [];
        if (URL_LIKE.test(q)) {
            const url = /^https?:\/\//i.test(q) ? q : `http${q.startsWith('localhost') ? '' : 's'}://${q}`;
            rows.push({id: `web:url:${url}`, name: url, description: 'Open in browser', icon: 'web-browser-symbolic', copy: url, run: () => openUri(url)});
        }
        const [first, ...rest] = q.split(/\s+/);
        const engines = this._engines();
        const shortcut = engines.find(e => e.key === first.toLowerCase());
        if (shortcut && rest.length > 0)
            rows.push(this._searchRow(shortcut.name, shortcut.url, rest.join(' ')));
        if (forced || this._settings.get_boolean('feature-web-fallback')) {
            const engine = this._settings.get_string('search-engine');
            let host = 'the web';
            try {
                host = GLib.Uri.parse(engine.replace('%s', 'x'), GLib.UriFlags.NONE).get_host()?.replace(/^www\./, '') || host;
            } catch {}
            if (engine.includes('%s'))
                rows.push(this._searchRow(host, engine, q));
        }
        return Promise.resolve(this._store(rows));
    }
}

const BOOKMARK_ICONS = {
    command: 'utilities-terminal-symbolic',
    site: 'web-browser-symbolic',
    location: 'folder-remote-symbolic',
    folder: 'folder-symbolic',
    file: 'text-x-generic-symbolic',
};

export class BookmarkSearchProvider extends BaseProvider {
    constructor(settings) {
        super(settings, 'yags-bookmarks', 'Bookmarks', '*');
        this._mtime = -1;
        this._list = [];
        this.onChanged = null;
    }

    _bookmarks() {
        let mtime = 0;
        try {
            mtime = Gio.File.new_for_path(Bookmarks.BOOKMARKS_FILE)
                .query_info('time::modified', Gio.FileQueryInfoFlags.NONE, null)
                .get_attribute_uint64('time::modified');
        } catch {}
        if (mtime !== this._mtime) {
            this._mtime = mtime;
            this._list = Bookmarks.load();
        }
        return this._list;
    }

    _changed() {
        this._mtime = -1;
        this.onChanged?.();
    }

    add(target, name = '') {
        const entry = Bookmarks.add(target, name);
        this._changed();
        return entry;
    }

    remove(name) {
        const removed = Bookmarks.remove(name);
        this._changed();
        return removed;
    }

    has(target) {
        return Bookmarks.find(target) !== null;
    }

    _addRow(text) {
        const parsed = Bookmarks.parseAddCommand(text);
        if (!parsed) {
            return [{
                id: `bm:add-help:${text}`,
                name: 'Add a bookmark',
                description: 'Type a path, URL, sftp:// location or "> command", optionally after a name',
                icon: 'list-add-symbolic',
                copy: '',
            }];
        }
        const target = Bookmarks.normalizeTarget(parsed.target);
        const name = parsed.name || Bookmarks.defaultName(target);
        const kind = Bookmarks.kindOf(target);
        const exists = Bookmarks.find(target);
        return [{
            id: `bm:add:${name}:${target}`,
            name: `Add "${name}"`,
            description: `${exists ? `Replaces "${exists.name}" · ` : ''}${kind} bookmark · ${target}`,
            icon: 'list-add-symbolic',
            copy: target,
            run: () => {
                const entry = this.add(target, name);
                Main.notify('yags', `Bookmarked "${entry.name}"`, entry.target);
            },
        }];
    }

    getInitialResultSet(terms) {
        const {q, forced} = stripKeyword(terms, this.keyword);
        if (forced && q.startsWith('+'))
            return Promise.resolve(this._store(this._addRow(q.slice(1))));
        const words = q.toLowerCase().split(/\s+/).filter(Boolean);
        if (!forced && words.length === 0)
            return Promise.resolve(this._store([]));
        const rows = [];
        for (const b of this._bookmarks()) {
            const hay = `${b.name} ${b.target} ${(b.tags ?? []).join(' ')}`.toLowerCase();
            if (!words.every(w => hay.includes(w)))
                continue;
            const kind = b.type ?? Bookmarks.kindOf(b.target);
            const target = b.target;
            let run;
            if (kind === 'command')
                run = () => runInTerminal(this._settings, target.replace(/^>\s*/, ''));
            else if (kind === 'site')
                run = () => openUri(/^https?:\/\//i.test(target) ? target : `https://${target}`);
            else if (kind === 'location' || target.startsWith('file://'))
                run = () => openUri(target);
            else
                run = () => openUri(GLib.filename_to_uri(Bookmarks.expandPath(target), null));
            rows.push({
                id: `bm:${b.name}:${target}`,
                name: b.name,
                description: `${kind[0].toUpperCase()}${kind.slice(1)} bookmark · ${target}`,
                icon: BOOKMARK_ICONS[kind] ?? 'user-bookmarks-symbolic',
                copy: target.replace(/^>\s*/, ''),
                kind,
                target,
                bookmarkName: b.name,
                starts: b.name.toLowerCase().startsWith(words[0] ?? ''),
                run,
            });
        }
        rows.sort((a, b) => Number(b.starts) - Number(a.starts));
        if (forced && rows.length === 0 && q)
            rows.push(...this._addRow(q));
        return Promise.resolve(this._store(rows));
    }
}

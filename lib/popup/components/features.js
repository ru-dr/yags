// SPDX-License-Identifier: GPL-3.0-or-later
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Graphene from 'gi://Graphene';
import Pango from 'gi://Pango';
import Shell from 'gi://Shell';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Search from 'resource:///org/gnome/shell/ui/search.js';
import {FilterMode} from './macResults.js';
import {PreviewPane} from './previewPane.js';
import {FileSearchProvider} from '../../search/fileProvider.js';
import {ClipboardSearchProvider} from '../../search/clipboardProvider.js';

const BAR_ICON_SIZE = 24;
const FILTERS = [
    {mode: FilterMode.APPS, icon: 'view-app-grid-symbolic', hint: 'Search Apps'},
    {mode: FilterMode.FILES, icon: 'folder-symbolic', hint: 'Search Files'},
    {mode: FilterMode.ACTIONS, icon: 'system-run-symbolic', hint: 'Search Actions'},
    {mode: FilterMode.CLIPBOARD, icon: 'edit-paste-symbolic', hint: 'Search Clipboard'},
];
const MUTED_KEYBINDING = /^(switch-to-application|app-hotkey|app-shift-hotkey|app-ctrl-hotkey)-[1-4]$/;
const SUPER = Clutter.ModifierType.SUPER_MASK | Clutter.ModifierType.MOD4_MASK;

function kindOf(row) {
    if (row.provider.id === 'applications')
        return row.metaInfo.id.endsWith('.desktop') ? 'Application' : 'System Action';
    if (row.provider.id === 'yags-files')
        return GLib.file_test(row.metaInfo.id, GLib.FileTest.IS_DIR) ? 'Folder' : 'File';
    return row.provider.displayName ?? row.provider.appInfo?.get_name() ?? '';
}

export class YagsFeatures {
    constructor(popup) {
        this._popup = popup;
        this._settings = popup._settings;
        this._view = null;
        this._entry = null;
        this._layout = null;
        this._selected = null;
        this._refreshId = 0;
        this._lastQuery = '';
        this._mutedModes = null;
        this._superComboAt = 0;

        this.bar = new St.Widget({
            style_class: 'yags-bar',
            layout_manager: new Clutter.BinLayout(),
            x_expand: true,
        });
        this._row = new St.BoxLayout({x_expand: true});
        this.bar.add_child(this._row);
        this._filterBox = new St.BoxLayout({
            style_class: 'yags-filters',
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._filterButtons = new Map();
        for (const [index, filter] of FILTERS.entries()) {
            const button = new St.Button({
                style_class: 'yags-filter-button',
                can_focus: false,
                accessible_name: `${filter.hint} (Super+${index + 1})`,
                child: new St.Icon({icon_name: filter.icon, style_class: 'yags-filter-icon'}),
            });
            button.connect('clicked', () => this._toggleFilter(filter.mode));
            this._filterButtons.set(filter.mode, button);
            this._filterBox.add_child(button);
        }
        this._ghost = new St.Label({
            style_class: 'yags-ghost',
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.START,
            visible: false,
        });
        this._ghost.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        this.bar.add_child(this._ghost);
        this._completion = null;

        this._preview = new PreviewPane();
        this._fileProvider = new FileSearchProvider(this._settings);
        this._clipboardProvider = new ClipboardSearchProvider(
            () => this._layout?.filter === FilterMode.CLIPBOARD);
    }

    enable(stealer) {
        this._view = stealer.searchResults;
        this._entry = stealer.entry;
        this._layout = stealer.layout;
        this._layout.onUpdate = () => this._queueRefresh();
        this._layout.settings = this._settings;
        this._originalIcon = this._entry.get_primary_icon();
        this._barIcon = new St.Icon({style_class: 'search-entry-icon', icon_name: 'edit-find-symbolic'});
        this._entry.set_primary_icon(this._barIcon);

        this._view._registerProvider(this._fileProvider);
        this._view._registerProvider(this._clipboardProvider);

        this._viewOrientation = this._view.orientation;
        this._view.orientation = Clutter.Orientation.HORIZONTAL;
        this._view.add_child(this._preview.actor);

        this._entry.clutter_text.connectObject('text-changed', () => this._queueRefresh(), this);
    }

    disable() {
        if (!this._view)
            return;
        this._entry.clutter_text.disconnectObject(this);
        this._cancelRefresh();
        this._view.remove_child(this._preview.actor);
        this._view.orientation = this._viewOrientation;
        this._view._unregisterProvider(this._fileProvider);
        this._view._unregisterProvider(this._clipboardProvider);
        this._entry.set_primary_icon(this._originalIcon);
        this._layout.filter = null;
        this._layout.settings = null;
        this._layout.onUpdate = null;
        this._view = this._entry = this._layout = null;
    }

    destroy() {
        this.disable();
        this._preview.destroy();
        this.bar.destroy();
    }

    attachEntry(entry) {
        this._row.add_child(entry);
        entry.x_expand = true;
        this._row.add_child(this._filterBox);
    }

    detachEntry(entry) {
        if (entry.get_parent() === this._row)
            this._row.remove_child(entry);
        if (this._filterBox.get_parent() === this._row)
            this._row.remove_child(this._filterBox);
    }

    takeSuperCombo() {
        const recent = GLib.get_monotonic_time() - this._superComboAt < 1500000;
        this._superComboAt = 0;
        return recent;
    }

    get lastQuery() {
        return this._on('feature-remember-query') ? this._lastQuery : '';
    }

    _on(key) {
        return this._settings.get_boolean(key);
    }

    get _placeholder() {
        return this._settings.get_string('placeholder');
    }

    onOpen() {
        this._filterBox.visible = this._on('feature-filters');
        this._filterButtons.get(FilterMode.CLIPBOARD).visible =
            this._on('feature-clipboard') && this._clipboardProvider.available;
        this._entry.hint_text = this._placeholder;
        if (this._on('feature-filters')) {
            this._mutedModes = new Map();
            for (const [name, mode] of Object.entries(Main.wm._allowedKeybindings)) {
                if (MUTED_KEYBINDING.test(name)) {
                    this._mutedModes.set(name, mode);
                    Main.wm._allowedKeybindings[name] = Shell.ActionMode.NONE;
                }
            }
        }
        global.stage.connectObject('captured-event', (_, event) => this._onKey(event), this);
        global.stage.connectObject('notify::key-focus', () => this._queueRefresh(), this);
    }

    onShown() {
        this._entry.clutter_text.set_selection(0, -1);
        this._queueRefresh();
    }

    onClose() {
        this._lastQuery = this._entry.get_text();
        global.stage.disconnectObject(this);
        if (this._mutedModes) {
            for (const [name, mode] of this._mutedModes)
                Main.wm._allowedKeybindings[name] = mode;
            this._mutedModes = null;
        }
        this._setFilter(null, false);
        this._showSelection(null);
    }

    _onKey(event) {
        if (event.type() !== Clutter.EventType.KEY_PRESS)
            return Clutter.EVENT_PROPAGATE;
        const symbol = event.get_key_symbol();
        const text = this._entry.clutter_text;
        const inEntry = global.stage.get_key_focus() === text;

        if (event.get_state() & SUPER) {
            this._superComboAt = GLib.get_monotonic_time();
            const index = symbol - Clutter.KEY_1;
            if (index >= 0 && index < FILTERS.length && this._on('feature-filters')) {
                if (this._filterButtons.get(FILTERS[index].mode).visible)
                    this._toggleFilter(FILTERS[index].mode);
                return Clutter.EVENT_STOP;
            }
            if (!this._on('feature-file-actions'))
                return Clutter.EVENT_PROPAGATE;
            if (symbol === Clutter.KEY_Return || symbol === Clutter.KEY_KP_Enter) {
                this._revealSelected();
                return Clutter.EVENT_STOP;
            }
            if (symbol === Clutter.KEY_c || symbol === Clutter.KEY_C) {
                this._copySelectedPath();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        }

        const atEnd = text.cursor_position === -1 || text.cursor_position === text.text.length;
        if (inEntry && this._completion !== null && atEnd &&
            (symbol === Clutter.KEY_Tab || symbol === Clutter.KEY_Right)) {
            this._entry.set_text(this._completion);
            text.set_selection(-1, -1);
            return Clutter.EVENT_STOP;
        }

        if (inEntry && symbol === Clutter.KEY_BackSpace &&
            text.text === '' && this._layout.filter !== null) {
            this._setFilter(null);
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }

    _toggleFilter(mode) {
        this._setFilter(this._layout.filter === mode ? null : mode);
        this._entry.grab_key_focus();
    }

    _setFilter(mode, search = true) {
        if (!this._layout)
            return;
        for (const [m, button] of this._filterButtons) {
            if (m === mode)
                button.add_style_pseudo_class('checked');
            else
                button.remove_style_pseudo_class('checked');
        }
        this._entry.hint_text = FILTERS.find(f => f.mode === mode)?.hint ?? this._placeholder;
        if (search)
            this._layout.setFilter(mode);
        else
            this._layout.filter = mode;
    }

    _selectedFilePath() {
        const row = this._selected;
        return row?.provider.id === 'yags-files' ? row.metaInfo.id : null;
    }

    _revealSelected() {
        const path = this._selectedFilePath();
        if (!path)
            return;
        Gio.DBus.session.call(
            'org.freedesktop.FileManager1', '/org/freedesktop/FileManager1',
            'org.freedesktop.FileManager1', 'ShowItems',
            new GLib.Variant('(ass)', [[GLib.filename_to_uri(path, null)], '']),
            null, Gio.DBusCallFlags.NONE, -1, null, null);
        this._popup.close();
    }

    _copySelectedPath() {
        const path = this._selectedFilePath();
        if (!path)
            return;
        St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, path);
        this._popup.close();
    }

    _queueRefresh() {
        if (this._refreshId)
            return;
        this._refreshId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._refreshId = 0;
            this._refresh();
            return GLib.SOURCE_REMOVE;
        });
    }

    _cancelRefresh() {
        if (this._refreshId) {
            GLib.source_remove(this._refreshId);
            this._refreshId = 0;
        }
    }

    _refresh() {
        if (!this._view || !this._popup._visible)
            return;
        const focus = global.stage.get_key_focus();
        let row = null;
        if (focus instanceof Search.SearchResult && this._view.contains(focus))
            row = focus;
        else if (this._entry.get_text().trim() !== '')
            row = this._view._defaultResult;
        if (row && !row.mapped)
            row = null;
        this._showSelection(row);
    }

    _showSelection(row) {
        this._selected = row;
        this._preview.show(this._on('feature-preview') ? row : null, this._clipboardProvider);
        this._updateBarIcon(row);
        this._updateGhost(row);
    }

    _updateBarIcon(row) {
        let gicon = null;
        if (row?.metaInfo.createIcon) {
            const icon = row.metaInfo.createIcon(BAR_ICON_SIZE);
            if (icon instanceof St.Icon)
                gicon = icon.gicon;
            icon?.destroy();
        }
        if (gicon && this._on('feature-bar-icon')) {
            this._barIcon.gicon = gicon;
            this._barIcon.add_style_class_name('yags-bar-result-icon');
        } else {
            this._barIcon.icon_name = 'edit-find-symbolic';
            this._barIcon.remove_style_class_name('yags-bar-result-icon');
        }
    }

    _updateGhost(row) {
        this._completion = null;
        const text = this._entry.get_text();
        const clutterText = this._entry.clutter_text;
        if (!row || row !== this._view?._defaultResult || text === '' ||
            !this._on('feature-completion') ||
            row.provider.id === 'yags-clipboard' ||
            global.stage.get_key_focus() !== clutterText) {
            this._ghost.hide();
            return;
        }
        const name = row.metaInfo.name;
        const kind = kindOf(row);
        let ghost;
        if (name.toLowerCase() === text.toLowerCase()) {
            ghost = kind ? ` — ${kind}` : '';
        } else if (name.toLowerCase().startsWith(text.toLowerCase())) {
            this._completion = name;
            ghost = `${name.slice(text.length)} — ${kind}`;
        } else {
            ghost = ` — ${kind ? `${name} (${kind})` : name}`;
        }
        this._ghost.text = ghost;

        const [ok, x] = clutterText.position_to_coords(-1);
        if (!ok) {
            this._ghost.hide();
            return;
        }
        const origin = clutterText.apply_relative_transform_to_point(
            this.bar, new Graphene.Point3D({x, y: 0, z: 0}));
        const clear = this._entry.get_secondary_icon();
        const limit = this._row.x + this._entry.x + this._entry.width -
            (clear?.visible ? clear.width + 12 : 8);
        const width = limit - origin.x;
        if (width < 40) {
            this._ghost.hide();
            return;
        }
        this._ghost.set_position(Math.round(origin.x), Math.round(origin.y));
        this._ghost.width = width;
        this._ghost.show();
    }
}

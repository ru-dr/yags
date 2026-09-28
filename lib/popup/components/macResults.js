// SPDX-License-Identifier: GPL-3.0-or-later
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Shell from 'gi://Shell';
import * as Search from 'resource:///org/gnome/shell/ui/search.js';
import * as SystemActions from 'resource:///org/gnome/shell/misc/systemActions.js';

const SearchResultsBase = Object.getPrototypeOf(Search.ListSearchResults);
const MAX_ROWS = 5;
const ROW_ICON_SIZE = 24;
const TOP_HIT_ICON_SIZE = 32;
const TWO_LINE_ICON_SIZE = 32;
const CALCULATOR_ID = 'org.gnome.Calculator.desktop';
const SETTINGS_ID = 'org.gnome.Settings.desktop';
const TAIL = ['yags-files', 'yags-clipboard', 'yags-shell', 'yags-web'];

export const FilterMode = {
    APPS: 'apps',
    FILES: 'files',
    ACTIONS: 'actions',
    CLIPBOARD: 'clipboard',
};

export function appInfoId(provider) {
    return provider.appInfo?.get_id() ?? null;
}

export function providerKey(provider) {
    return appInfoId(provider) ?? provider.id;
}

export function kindOf(row) {
    const {provider, metaInfo} = row;
    if (provider.id === 'applications') {
        if (!metaInfo.id.endsWith('.desktop'))
            return 'System action';
        const app = Shell.AppSystem.get_default().lookup_app(metaInfo.id);
        return app?.get_app_info()?.get_description() || 'Application';
    }
    if (provider.id === 'yags-files')
        return GLib.file_test(metaInfo.id, GLib.FileTest.IS_DIR) ? 'Folder' : 'File';
    return provider.displayName ?? provider.appInfo?.get_name() ?? '';
}

function allows(layout, provider, id) {
    if (layout.keyword)
        return provider.id === layout.keyword;
    const mode = layout.filter;
    const isApps = provider.id === 'applications';
    if (provider.id === 'yags-clipboard')
        return mode === FilterMode.CLIPBOARD;
    switch (mode) {
    case FilterMode.APPS:
        return (isApps && id.endsWith('.desktop')) || provider.id === 'yags-windows';
    case FilterMode.FILES:
        return provider.id === 'yags-files';
    case FilterMode.ACTIONS:
        return (isApps && !id.endsWith('.desktop')) || provider.id === 'yags-calc' ||
            [SETTINGS_ID, CALCULATOR_ID].includes(appInfoId(provider));
    case FilterMode.CLIPBOARD:
        return false;
    default:
        return true;
    }
}

function macCalculatorMeta(meta) {
    const match = /^\s*=\s*(-?[\d.]+(?:e[+-]?\d+)?)\s*$/i.exec(meta.description ?? '');
    if (!match)
        return meta;
    const value = Number(match[1]);
    const unit = /\s(?:in|to|as|into)\s+(.+)$/i.exec(meta.name)?.[1] ?? '';
    const digits = /^[a-z]{3}$/i.test(unit) ? 2 : 4;
    const text = value.toLocaleString('en-US', {maximumFractionDigits: digits});
    return {
        ...meta,
        name: unit ? `${text} ${unit}` : text,
        description: `${meta.name} = ${text}`,
        clipboardText: String(Number(value.toFixed(digits))),
    };
}

function rowIcon(row) {
    const content = row.get_child();
    for (const child of [...content.get_children(), ...(content.get_first_child()?.get_children?.() ?? [])]) {
        if (child instanceof St.Icon)
            return child;
    }
    return null;
}

function makeTwoLine(row) {
    const content = row.get_child();
    const titleBox = content.get_first_child();
    const parts = titleBox.get_children();
    const icon = parts.find(c => !(c instanceof St.Label)) ?? null;
    const title = parts.find(c => c instanceof St.Label);
    const description = row._descriptionLabel ?? null;
    content.remove_all_children();
    titleBox.remove_all_children();
    titleBox.destroy();

    content.x_align = Clutter.ActorAlign.FILL;
    content.add_child(new St.Widget({style_class: 'yags-row-indicator', y_align: Clutter.ActorAlign.CENTER}));
    if (icon) {
        if (icon instanceof St.Icon)
            icon.icon_size = TWO_LINE_ICON_SIZE;
        else
            icon.set_size(TWO_LINE_ICON_SIZE - 4, TWO_LINE_ICON_SIZE - 4);
        icon.y_align = Clutter.ActorAlign.CENTER;
        content.add_child(icon);
    }
    const text = new St.BoxLayout({
        style_class: 'yags-row-text',
        orientation: Clutter.Orientation.VERTICAL,
        x_expand: true,
        y_align: Clutter.ActorAlign.CENTER,
    });
    title.add_style_class_name('yags-row-title');
    text.add_child(title);
    text.add_child(description ?? new St.Label({
        style_class: 'list-search-result-description',
        text: kindOf(row),
    }));
    content.add_child(text);
}

const MacSearchSection = GObject.registerClass(
class MacSearchSection extends SearchResultsBase {
    _init(provider, resultsView, layout) {
        super._init(provider, resultsView);
        this._layout = layout;
        this._topRow = null;
        this._dead = false;
        this.connect('destroy', () => (this._dead = true));
        this._headers = layout.style === 'mac';
        this.add_style_class_name('yags-section');

        const box = new St.BoxLayout({
            orientation: Clutter.Orientation.VERTICAL,
            x_expand: true,
        });
        this._topHeader = new St.Label({
            style_class: 'yags-section-header',
            text: 'Top Hit',
            visible: false,
        });
        this._topSlot = new St.BoxLayout({
            orientation: Clutter.Orientation.VERTICAL,
            x_expand: true,
            visible: false,
        });
        this._header = new St.Label({
            style_class: 'yags-section-header',
            text: provider.displayName ?? provider.appInfo?.get_name() ?? 'Applications',
            visible: this._headers,
        });
        this._content = new St.BoxLayout({
            style_class: 'list-search-results',
            orientation: Clutter.Orientation.VERTICAL,
            x_expand: true,
        });
        box.add_child(this._topHeader);
        box.add_child(this._topSlot);
        box.add_child(this._header);
        box.add_child(this._content);
        this._resultDisplayBin.child = box;
    }

    updateSearch(providerResults, terms) {
        const results = providerResults.filter(id => allows(this._layout, this.provider, id));
        this._prune(new Set(results));
        return super.updateSearch(results, terms);
    }

    _prune(keep) {
        const view = this._resultsView;
        const focus = global.stage.get_key_focus();
        for (const [id, display] of Object.entries(this._resultDisplays)) {
            if (keep.has(id) || display === view._defaultResult || display === focus || display.contains?.(focus))
                continue;
            if (display === this._topRow)
                this.setTopHit(null);
            delete this._resultDisplays[id];
            display.destroy();
        }
    }

    _getMaxDisplayedResults() {
        return this._layout.settings?.get_int('max-rows') ?? MAX_ROWS;
    }

    clear() {
        this.setTopHit(null);
        super.clear();
    }

    _clearResultDisplay() {
        if (this._dead)
            return;
        this.setTopHit(null);
        this._content.remove_all_children();
    }

    _createResultDisplay(meta) {
        if (appInfoId(this.provider) === CALCULATOR_ID &&
            this._layout.settings?.get_boolean('feature-calculator-style'))
            meta = macCalculatorMeta(meta);
        const row = new Search.ListSearchResult(this.provider, meta, this._resultsView);
        if (this.provider.id === 'applications') {
            row.activate = () => {
                const app = Shell.AppSystem.get_default().lookup_app(meta.id);
                if (app)
                    app.activate();
                else
                    SystemActions.getDefault().activateAction(meta.id);
            };
        }
        if (!this._headers)
            makeTwoLine(row);
        return row;
    }

    _addItem(display) {
        if (this._dead)
            return;
        this._content.add_child(display);
        this._header.visible = this._headers;
    }

    getFirstResult() {
        if (this._topRow)
            return this._topRow;
        return this._content.get_children().find(child => child.visible) ?? null;
    }

    setTopHit(row) {
        if (this._topRow === row)
            return;
        const resize = this._headers;
        if (this._topRow) {
            const old = this._topRow;
            this._topSlot.remove_child(old);
            old.remove_style_class_name('yags-top-hit');
            if (resize)
                rowIcon(old)?.set_icon_size(ROW_ICON_SIZE);
            this._content.insert_child_at_index(old, 0);
        }
        this._topRow = row;
        if (row) {
            this._content.remove_child(row);
            this._topSlot.add_child(row);
            row.add_style_class_name('yags-top-hit');
            if (resize)
                rowIcon(row)?.set_icon_size(TOP_HIT_ICON_SIZE);
        }
        this._topSlot.visible = row !== null;
        this._topHeader.visible = row !== null && this._headers;
        this._header.visible = this._headers && this._content.get_n_children() > 0;
    }

    hasRow(actor) {
        return this._topSlot.contains(actor) || this._content.contains(actor);
    }
});

export class MacResultsLayout {
    constructor() {
        this._view = null;
        this._originals = null;
        this.filter = null;
        this.keyword = null;
        this.onUpdate = null;
        this.settings = null;
    }

    get style() {
        return this.settings?.get_string('style') ?? 'mac';
    }

    isDisabled(provider) {
        const off = this.settings?.get_strv('disabled-providers') ?? [];
        return off.includes(provider.id) || off.includes(appInfoId(provider));
    }

    setSettings(settings) {
        this.settings = settings;
        settings.connectObject('changed::style', () => this._rebuild(), this);
        this._rebuild();
    }

    apply(view) {
        this._view = view;
        const layout = this;
        this._originals = {
            ensure: view._ensureProviderDisplay,
            select: view._maybeSetInitialSelection,
            search: view._doProviderSearch,
            register: view._registerProvider,
        };
        view._registerProvider = provider => {
            this._originals.register.call(view, provider);
            this.keepTail();
        };
        view._ensureProviderDisplay = provider => {
            if (provider.display)
                return;
            const section = new MacSearchSection(provider, view, this);
            section.connect('notify::focus-child', view._focusChildChanged.bind(view));
            section.hide();
            view._content.add_child(section);
            provider.display = section;
        };
        view._maybeSetInitialSelection = () => {
            this._originals.select.call(view);
            this._syncTopHit();
            this.onUpdate?.();
        };
        view._doProviderSearch = async function (provider, previousResults) {
            if (!layout.isDisabled(provider) &&
                !(layout.keyword && provider.id !== layout.keyword))
                return layout._originals.search.call(this, provider, previousResults);
            this._results[provider.id] = [];
            await this._updateResults(provider, this._terms, []);
        };
        this._rebuild();
    }

    revert() {
        if (!this._view)
            return;
        this.settings?.disconnectObject(this);
        this._view._ensureProviderDisplay = this._originals.ensure;
        this._view._maybeSetInitialSelection = this._originals.select;
        this._view._doProviderSearch = this._originals.search;
        this._view._registerProvider = this._originals.register;
        this.settings = null;
        this._rebuild();
        this._view = null;
        this._originals = null;
        this.filter = null;
        this.keyword = null;
        this.onUpdate = null;
    }

    setFilter(mode) {
        this.filter = mode;
        this.research();
    }

    research() {
        if (this._view?.mapped && this._view._terms.length > 0)
            this._view._doSearch();
    }

    keepTail() {
        for (const id of TAIL) {
            const provider = this._view._providers.find(p => p.id === id);
            if (provider)
                this.moveProvider(provider, this._view._providers.length);
        }
    }

    moveProvider(provider, index) {
        const list = this._view._providers;
        const from = list.indexOf(provider);
        if (from < 0)
            return;
        list.splice(from, 1);
        list.splice(Math.min(index, list.length), 0, provider);
        if (provider.display)
            this._view._content.set_child_at_index(provider.display, Math.min(index, list.length - 1));
    }

    _syncTopHit() {
        const enabled = this.settings?.get_boolean('feature-top-hit') ?? true;
        const top = enabled ? this._view._defaultResult : null;
        for (const provider of this._view._providers) {
            const display = provider.display;
            if (display instanceof MacSearchSection)
                display.setTopHit(top && display.hasRow(top) ? top : null);
        }
    }

    _rebuild() {
        if (!this._view)
            return;
        this._view._cancellable.cancel();
        this._view._cancellable = new Gio.Cancellable();
        for (const provider of this._view._providers) {
            provider.display?.destroy();
            provider.display = null;
        }
        for (const provider of this._view._providers)
            this._view._ensureProviderDisplay(provider);
        this._view._defaultResult = null;
        this.research();
    }
}

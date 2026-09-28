// SPDX-License-Identifier: GPL-3.0-or-later
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import Shell from 'gi://Shell';
import * as Search from 'resource:///org/gnome/shell/ui/search.js';
import * as SystemActions from 'resource:///org/gnome/shell/misc/systemActions.js';

const SearchResultsBase = Object.getPrototypeOf(Search.ListSearchResults);
const MAX_ROWS = 5;
const ROW_ICON_SIZE = 24;
const TOP_HIT_ICON_SIZE = 32;
const CALCULATOR_ID = 'org.gnome.Calculator.desktop';
const SETTINGS_ID = 'org.gnome.Settings.desktop';

export const FilterMode = {
    APPS: 'apps',
    FILES: 'files',
    ACTIONS: 'actions',
    CLIPBOARD: 'clipboard',
};

function appInfoId(provider) {
    return provider.appInfo?.get_id() ?? null;
}

function allows(mode, provider, id) {
    const isApps = provider.id === 'applications';
    if (provider.id === 'yags-clipboard')
        return mode === FilterMode.CLIPBOARD;
    switch (mode) {
    case FilterMode.APPS:
        return isApps && id.endsWith('.desktop');
    case FilterMode.FILES:
        return provider.id === 'yags-files';
    case FilterMode.ACTIONS:
        return (isApps && !id.endsWith('.desktop')) ||
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
    const icon = row.get_child()?.get_first_child()?.get_first_child();
    return icon instanceof St.Icon ? icon : null;
}

const MacSearchSection = GObject.registerClass(
class MacSearchSection extends SearchResultsBase {
    _init(provider, resultsView, layout) {
        super._init(provider, resultsView);
        this._layout = layout;
        this._topRow = null;
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
        const mode = this._layout.filter;
        return super.updateSearch(
            providerResults.filter(id => allows(mode, this.provider, id)), terms);
    }

    _getMaxDisplayedResults() {
        return this._layout.settings?.get_int('max-rows') ?? MAX_ROWS;
    }

    clear() {
        this.setTopHit(null);
        super.clear();
    }

    _clearResultDisplay() {
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
        return row;
    }

    _addItem(display) {
        this._content.add_child(display);
        this._header.visible = true;
    }

    getFirstResult() {
        if (this._topRow)
            return this._topRow;
        return this._content.get_children().find(child => child.visible) ?? null;
    }

    setTopHit(row) {
        if (this._topRow === row)
            return;
        if (this._topRow) {
            const old = this._topRow;
            this._topSlot.remove_child(old);
            old.remove_style_class_name('yags-top-hit');
            rowIcon(old)?.set_icon_size(ROW_ICON_SIZE);
            this._content.insert_child_at_index(old, 0);
        }
        this._topRow = row;
        if (row) {
            this._content.remove_child(row);
            this._topSlot.add_child(row);
            row.add_style_class_name('yags-top-hit');
            rowIcon(row)?.set_icon_size(TOP_HIT_ICON_SIZE);
        }
        this._topHeader.visible = this._topSlot.visible = row !== null;
        this._header.visible = this._content.get_n_children() > 0;
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
        this.onUpdate = null;
        this.settings = null;
    }

    apply(view) {
        this._view = view;
        this._originals = {
            ensure: view._ensureProviderDisplay,
            select: view._maybeSetInitialSelection,
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
        this._rebuild();
    }

    revert() {
        if (!this._view)
            return;
        this._view._ensureProviderDisplay = this._originals.ensure;
        this._view._maybeSetInitialSelection = this._originals.select;
        this._rebuild();
        this._view = null;
        this._originals = null;
        this.filter = null;
        this.onUpdate = null;
        this.settings = null;
    }

    setFilter(mode) {
        this.filter = mode;
        if (this._view._terms.length > 0)
            this._view._doSearch();
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
        for (const provider of this._view._providers) {
            provider.display?.destroy();
            provider.display = null;
        }
        for (const provider of this._view._providers)
            this._view._ensureProviderDisplay(provider);
    }
}

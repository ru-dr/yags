// SPDX-License-Identifier: GPL-3.0-or-later
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import Clutter from 'gi://Clutter';
import {MacResultsLayout} from '../popup/components/macResults.js';

export class OverviewSearchStealer {
    constructor(popup) {
        this._popup = popup;
        this._entry = null;
        this._entryParent = null;
        this._search = null;
        this._searchParent = null;
        this._searchResults = null;
        this._originalActivateDefault = null;
        this._originalActivate = null;
        this._overviewKeyCaptureId = 0;
        this._originalHintText = null;
        this._macLayout = new MacResultsLayout();
    }

    get entry() {
        return this._entry;
    }

    get search() {
        return this._search;
    }

    get searchResults() {
        return this._searchResults;
    }

    get layout() {
        return this._macLayout;
    }

    steal() {
        if (this._entry)
            return;

        if (!Main.overview._originalToggle) {
            Main.overview._originalToggle = Main.overview.toggle;
            Main.overview.toggle = () => {
                if (this._popup._visible) {
                    if (!this._popup._features.takeSuperCombo())
                        this._popup.close();
                } else
                    Main.overview._originalToggle();
            };
        }

        this._entry = Main.overview.searchEntry;
        this._entryParent = this._entry.get_parent();
        this._entry.add_style_class_name('yags-entry-stolen');
        this._originalHintText = this._entry.hint_text;
        if (this._entry.get_parent())
            this._entry.get_parent().remove_child(this._entry);
        this._entry.visible = false;

        this._search = Main.overview.searchController;
        this._searchResults = this._search._searchResults;
        this._searchParent = this._search.get_parent();
        if (this._search.get_parent())
            this._search.get_parent().remove_child(this._search);
        this._search.hide();
        this._searchResults.add_style_class_name('yags-results');
        this._macLayout.apply(this._searchResults);
        this._searchResults._statusContainer.remove_child(this._searchResults._statusSpinner);
        this._search._clearIcon.add_style_class_name('yags-clear-icon');

        this._originalActivateDefault = this._searchResults.activateDefault;
        this._searchResults.activateDefault = () => {
            this._popup.close();
            this._originalActivateDefault.call(this._searchResults);
        };

        if (this._searchResults.activate) {
            this._originalActivate = this._searchResults.activate;
            this._searchResults.activate = (...args) => {
                this._popup.close();
                this._originalActivate.call(this._searchResults, ...args);
            };
        }

        if (!this._search._originalSearchCancelled) {
            this._search._originalSearchCancelled = this._search._searchCancelled;
            this._search._searchCancelled = () => {};
        }

        if (this._overviewKeyCaptureId === 0) {
            this._overviewKeyCaptureId = global.stage.connect(
                'captured-event',
                (actor, event) => {
                    if (event.type() !== Clutter.EventType.KEY_PRESS)
                        return Clutter.EVENT_PROPAGATE;
                    if (!Main.overview.visible)
                        return Clutter.EVENT_PROPAGATE;
                    const unicode = Clutter.keysym_to_unicode(event.get_key_symbol());
                    if (unicode >= 0x20) {
                        if (this._popup._visible && this._entry)
                            this._entry.event(event);
                        return Clutter.EVENT_STOP;
                    }
                    return Clutter.EVENT_PROPAGATE;
                },
            );
        }
    }

    restore() {
        if (this._entry) {
            this._entry.remove_style_class_name('yags-entry-stolen');
            this._entry.hint_text = this._originalHintText;
            this._originalHintText = null;
            this._entry.visible = true;
            if (this._entry.get_parent())
                this._entry.get_parent().remove_child(this._entry);
            this._entryParent.add_child(this._entry);
            this._entry = null;
            this._entryParent = null;
        }

        if (this._search) {
            this._macLayout.revert();
            this._searchResults._statusContainer.insert_child_at_index(this._searchResults._statusSpinner, 0);
            this._search._clearIcon.remove_style_class_name('yags-clear-icon');
            this._searchResults.remove_style_class_name('yags-results');
            if (this._search._originalSearchCancelled) {
                this._search._searchCancelled = this._search._originalSearchCancelled;
                this._search._originalSearchCancelled = null;
            }
            if (this._originalActivateDefault) {
                this._searchResults.activateDefault = this._originalActivateDefault;
                this._originalActivateDefault = null;
            }
            if (this._originalActivate) {
                this._searchResults.activate = this._originalActivate;
                this._originalActivate = null;
            }
            if (this._search.get_parent())
                this._search.get_parent().remove_child(this._search);
            this._searchParent.add_child(this._search);
            this._search = null;
            this._searchParent = null;
            this._searchResults = null;
        }

        if (Main.overview._originalToggle) {
            Main.overview.toggle = Main.overview._originalToggle;
            Main.overview._originalToggle = null;
        }

        if (this._overviewKeyCaptureId !== 0) {
            global.stage.disconnect(this._overviewKeyCaptureId);
            this._overviewKeyCaptureId = 0;
        }
    }
}

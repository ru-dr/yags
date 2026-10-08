// SPDX-License-Identifier: GPL-3.0-or-later
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';

export function escape(text) {
    return GLib.markup_escape_text(String(text ?? ''), -1);
}

export function page(title, icon, groups) {
    const result = new Adw.PreferencesPage({title, icon_name: icon});
    for (const group of groups)
        result.add(group);
    return result;
}

export function group(title, rows, description = '') {
    const result = new Adw.PreferencesGroup({title, description});
    for (const row of rows)
        result.add(row);
    return result;
}

export function switchRow(settings, key, title, subtitle = '') {
    const row = new Adw.SwitchRow({title: escape(title), subtitle: escape(subtitle)});
    settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
    return row;
}

export function spinRow(settings, key, title, subtitle, lower, upper, step = 1) {
    const row = new Adw.SpinRow({
        title: escape(title),
        subtitle: escape(subtitle),
        adjustment: new Gtk.Adjustment({lower, upper, step_increment: step}),
    });
    settings.bind(key, row, 'value', Gio.SettingsBindFlags.DEFAULT);
    return row;
}

export function entryRow(settings, key, title) {
    const row = new Adw.EntryRow({title: escape(title)});
    settings.bind(key, row, 'text', Gio.SettingsBindFlags.DEFAULT);
    return row;
}

export function choiceRow(settings, key, title, subtitle, choices) {
    const row = new Adw.ComboRow({
        title: escape(title),
        subtitle: escape(subtitle),
        model: Gtk.StringList.new(choices.map(c => c.label)),
        selected: Math.max(0, choices.findIndex(c => c.value === settings.get_string(key))),
    });
    row.connect('notify::selected', () => settings.set_string(key, choices[row.selected].value));
    return row;
}

export function buttonRow(title, subtitle, buttons) {
    const row = new Adw.ActionRow({title: escape(title), subtitle: escape(subtitle)});
    for (const {label, onClicked, suggested} of buttons) {
        const button = new Gtk.Button({label, valign: Gtk.Align.CENTER});
        if (suggested)
            button.add_css_class('suggested-action');
        button.connect('clicked', onClicked);
        row.add_suffix(button);
    }
    return row;
}

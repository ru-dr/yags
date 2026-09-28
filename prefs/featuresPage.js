// SPDX-License-Identifier: GPL-3.0-or-later
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

const FEATURES = [
    ['feature-top-hit', 'Top Hit', 'Lift the best match into its own section'],
    ['feature-completion', 'Inline completion', 'Tab or Right accepts the faded rest of the name'],
    ['feature-bar-icon', 'Bar icon follows selection', 'The magnifier becomes the selected result icon'],
    ['feature-preview', 'Preview pane', 'Details beside the list'],
    ['feature-filters', 'Filter buttons', 'Apps, Files, Actions, Clipboard with Super+1 to 4'],
    ['feature-remember-query', 'Remember last search', 'Reopen with the previous query selected'],
    ['feature-bounce', 'Bounce on open', 'Slight spring when it opens'],
    ['feature-file-search', 'File search', 'plocate index plus recently used files'],
    ['feature-clipboard', 'Clipboard filter', 'Needs a supported clipboard manager'],
    ['feature-file-actions', 'File actions', 'Super+Enter shows in Files, Super+C copies path'],
    ['feature-calculator-style', 'Answer-first GNOME calculator', 'Only when the GNOME Calculator source is on'],
    ['feature-keywords', 'Prefix keywords', '= calc, > shell, < windows, ? files, ?? web, * bookmarks, : clipboard'],
    ['feature-row-actions', 'Row action buttons', 'New window, open folder, copy'],
    ['feature-currency', 'Currency conversion', 'Daily rates from open.er-api.com'],
    ['feature-web-fallback', 'Web search row', 'Always offer a web search last'],
    ['feature-shell-preview', 'Live shell output', 'Read-only allowlisted commands only'],
];

const NUMBERS = [
    ['width', 'Width', 'Popup width in pixels', 400, 1200, 10],
    ['top-offset', 'Top offset', 'Percent from the top of the screen', 5, 60, 1],
    ['max-rows', 'Rows per section', 'Results shown in each section', 1, 15, 1],
    ['corner-radius', 'Corner radius', 'Results card radius, the bar and rows follow it', 0, 40, 1],
    ['opacity', 'Opacity', 'Percent', 50, 100, 1],
    ['font-size', 'Bar font size', 'Pixels', 12, 32, 1],
];

export function buildFeaturesPage(settings) {
    const group = new Adw.PreferencesGroup({title: 'Features'});
    const styles = ['mac', 'powertoys'];
    const styleRow = new Adw.ComboRow({
        title: 'Style',
        subtitle: 'macOS Spotlight or PowerToys Run',
        model: Gtk.StringList.new(['macOS', 'PowerToys']),
        selected: Math.max(0, styles.indexOf(settings.get_string('style'))),
    });
    styleRow.connect('notify::selected', () => settings.set_string('style', styles[styleRow.selected]));
    group.add(styleRow);
    for (const [key, title, subtitle] of FEATURES) {
        const row = new Adw.SwitchRow({title, subtitle});
        settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(row);
    }
    return group;
}

export function buildCustomizePage(settings) {
    const group = new Adw.PreferencesGroup({title: 'Customize'});
    for (const [key, title, subtitle, lower, upper, step] of NUMBERS) {
        const row = new Adw.SpinRow({
            title,
            subtitle,
            adjustment: new Gtk.Adjustment({lower, upper, step_increment: step}),
        });
        settings.bind(key, row, 'value', Gio.SettingsBindFlags.DEFAULT);
        group.add(row);
    }
    for (const [key, title] of [['placeholder', 'Placeholder'], ['accent-color', 'Accent color (#rrggbb)']]) {
        const row = new Adw.EntryRow({title});
        settings.bind(key, row, 'text', Gio.SettingsBindFlags.DEFAULT);
        group.add(row);
    }
    return group;
}

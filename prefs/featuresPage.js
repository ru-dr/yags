// SPDX-License-Identifier: GPL-3.0-or-later
import {page, group, switchRow} from './widgets.js';

const FEATURES = [
    ['top-hit', 'Top Hit', 'Lift the best match into its own section'],
    ['completion', 'Inline completion', 'Tab or Right accepts the faded rest of the name'],
    ['bar-icon', 'Bar icon follows the selection', 'The magnifier becomes the selected result icon'],
    ['preview', 'Preview pane', 'Details beside the results'],
    ['filters', 'Filter buttons', 'Apps, Files, Actions and Clipboard, also Super+1 to Super+4'],
    ['row-actions', 'Row actions', 'Buttons on the selected row: bookmark, new window, open folder, copy'],
    ['file-actions', 'Super shortcuts for files', 'Super+Enter shows the file, Super+C copies its path'],
    ['keywords', 'Prefixes', 'Typing a plugin prefix searches only that plugin'],
    ['remember-query', 'Remember last search', 'Reopen with the previous query selected'],
    ['bounce', 'Bounce on open', 'A slight spring when it opens'],
    ['calculator-style', 'Answer-first GNOME Calculator', 'Only matters when the GNOME Calculator source is on'],
];

export function buildFeaturesPage({settings}) {
    return page('Features', 'emblem-system-symbolic', [
        group('Features', FEATURES.map(([key, title, subtitle]) => switchRow(settings, `feature-${key}`, title, subtitle))),
    ]);
}

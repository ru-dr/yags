// SPDX-License-Identifier: GPL-3.0-or-later
import {page, group, choiceRow, spinRow, entryRow} from './widgets.js';

const THEMES = [
    {value: 'default', label: 'Follow system'},
    {value: 'dark', label: 'Dark'},
    {value: 'light', label: 'Light'},
];
const STYLES = [
    {value: 'mac', label: 'macOS Spotlight'},
    {value: 'powertoys', label: 'PowerToys Run'},
];

export function buildAppearancePage({settings}) {
    return page('Appearance', 'applications-graphics-symbolic', [
        group('Look', [
            choiceRow(settings, 'style', 'Style', 'Layout of the bar and results', STYLES),
            choiceRow(settings, 'theme-preference', 'Theme', 'Dark, light, or follow the system', THEMES),
            entryRow(settings, 'accent-color', 'Accent color (#rrggbb)'),
            entryRow(settings, 'placeholder', 'Placeholder text'),
        ]),
        group('Size', [
            spinRow(settings, 'width', 'Width', 'Popup width in pixels', 400, 1200, 10),
            spinRow(settings, 'top-offset', 'Top offset', 'Percent from the top of the screen', 5, 60),
            spinRow(settings, 'max-rows', 'Rows per section', 'Results shown for each source', 1, 15),
            spinRow(settings, 'corner-radius', 'Corner radius', 'The bar, rows and preview follow it', 0, 40),
            spinRow(settings, 'opacity', 'Opacity', 'Percent', 50, 100),
            spinRow(settings, 'font-size', 'Bar font size', 'Pixels', 12, 32),
        ]),
    ]);
}

// SPDX-License-Identifier: GPL-3.0-or-later
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import Adw from 'gi://Adw';
import {buildShortcutPage} from './prefs/shortcutPage.js';
import {buildAppearancePage} from './prefs/appearancePage.js';
import {buildAboutPage} from './prefs/aboutPage.js';
import {buildFeaturesPage, buildCustomizePage} from './prefs/featuresPage.js';

export default class YagsPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const keyboardPage = new Adw.PreferencesPage({
            title: 'Keyboard',
            icon_name: 'input-keyboard-symbolic',
        });
        keyboardPage.add(buildShortcutPage(settings));
        window.add(keyboardPage);

        const appearancePage = new Adw.PreferencesPage({
            title: 'Appearance',
            icon_name: 'applications-graphics-symbolic',
        });
        appearancePage.add(buildAppearancePage(settings));
        window.add(appearancePage);

        const featuresPage = new Adw.PreferencesPage({
            title: 'Features',
            icon_name: 'emblem-system-symbolic',
        });
        featuresPage.add(buildFeaturesPage(settings));
        window.add(featuresPage);

        const customizePage = new Adw.PreferencesPage({
            title: 'Customize',
            icon_name: 'preferences-desktop-appearance-symbolic',
        });
        customizePage.add(buildCustomizePage(settings));
        window.add(customizePage);

        const aboutPage = new Adw.PreferencesPage({
            title: 'About',
            icon_name: 'help-about-symbolic',
        });
        aboutPage.add(buildAboutPage());
        window.add(aboutPage);

        window.set_search_enabled(true);
    }
}

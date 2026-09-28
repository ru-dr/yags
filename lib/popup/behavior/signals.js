// SPDX-License-Identifier: GPL-3.0-or-later
import Shell from 'gi://Shell';
import {applyTheme} from './theme.js';

export function connectGlobalSignals(popup, settings, ifaceSettings) {
    popup._windowCreatedId = global.display.connect(
        'window-created', () => { if (popup._visible) popup.close(); },
    );
    popup._appStateChangedId = Shell.AppSystem.get_default().connect(
        'app-state-changed', (_, app) => {
            if (popup._visible && app.state === Shell.AppState.STARTING)
                popup.close();
        },
    );
    ifaceSettings.connectObject(
        'changed::color-scheme', () => {
            if (popup._visible &&
                settings.get_string('theme-preference') === 'default')
                applyTheme(popup._content, settings, ifaceSettings);
        },
        popup,
    );
}

export function disconnectGlobalSignals(popup) {
    if (popup._windowCreatedId) {
        global.display.disconnect(popup._windowCreatedId);
        popup._windowCreatedId = 0;
    }
    if (popup._appStateChangedId) {
        Shell.AppSystem.get_default().disconnect(popup._appStateChangedId);
        popup._appStateChangedId = 0;
    }
    popup._ifaceSettings.disconnectObject(popup);
}

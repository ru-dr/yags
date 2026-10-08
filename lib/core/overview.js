// SPDX-License-Identifier: GPL-3.0-or-later
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export function leaveOverview() {
    if (Main.overview.visible)
        Main.overview.hide();
}

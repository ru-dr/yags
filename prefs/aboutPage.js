// SPDX-License-Identifier: GPL-3.0-or-later
import Adw from 'gi://Adw';

export function buildAboutPage() {
    const group = new Adw.PreferencesGroup({title: 'About'});
    group.add(new Adw.ActionRow({
        title: 'yags',
        subtitle: 'Yet Another GNOME Search, a macOS-inspired launcher.',
    }));
    group.add(new Adw.ActionRow({
        title: 'Version',
        subtitle: '1.0.0',
    }));
    group.add(new Adw.ActionRow({
        title: 'Based on',
        subtitle: 'Spotlight by itsnin, github.com/itsnin/spotlight',
    }));
    group.add(new Adw.ActionRow({
        title: 'License',
        subtitle: 'GPL-3.0-or-later',
    }));
    return group;
}

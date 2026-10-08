// SPDX-License-Identifier: GPL-3.0-or-later
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Shell from 'gi://Shell';

export const RowIconSize = Object.freeze({ROW: 24, TOP_HIT: 32, TWO_LINE: 32});

export function kindOf(row) {
    const {provider, metaInfo} = row;
    if (provider.id === 'applications') {
        if (!metaInfo.id.endsWith('.desktop'))
            return 'System action';
        const app = Shell.AppSystem.get_default().lookup_app(metaInfo.id);
        return app?.get_app_info()?.get_description() || 'Application';
    }
    if (provider.isYagsPlugin)
        return provider.result(metaInfo.id)?.kind ?? provider.displayName;
    return provider.displayName ?? provider.appInfo?.get_name() ?? '';
}

export function rowIcon(row) {
    const content = row.get_child();
    const candidates = [...content.get_children(), ...(content.get_first_child()?.get_children?.() ?? [])];
    return candidates.find(child => child instanceof St.Icon) ?? null;
}

export function answerFirstCalculatorMeta(meta) {
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

export function makeTwoLine(row) {
    const content = row.get_child();
    const titleBox = content.get_first_child();
    const parts = titleBox.get_children();
    const icon = parts.find(child => !(child instanceof St.Label)) ?? null;
    const title = parts.find(child => child instanceof St.Label);
    const description = row._descriptionLabel ?? null;
    content.remove_all_children();
    titleBox.remove_all_children();
    titleBox.destroy();

    content.x_align = Clutter.ActorAlign.FILL;
    content.add_child(new St.Widget({style_class: 'yags-row-indicator', y_align: Clutter.ActorAlign.CENTER}));
    if (icon) {
        if (icon instanceof St.Icon)
            icon.icon_size = RowIconSize.TWO_LINE;
        else
            icon.set_size(RowIconSize.TWO_LINE - 4, RowIconSize.TWO_LINE - 4);
        icon.y_align = Clutter.ActorAlign.CENTER;
        content.add_child(icon);
    }
    const text = new St.BoxLayout({
        style_class: 'yags-row-text',
        orientation: Clutter.Orientation.VERTICAL,
        x_expand: true,
        y_align: Clutter.ActorAlign.CENTER,
    });
    title.add_style_class_name('yags-row-title');
    text.add_child(title);
    text.add_child(description ?? new St.Label({style_class: 'list-search-result-description', text: kindOf(row)}));
    content.add_child(text);
}

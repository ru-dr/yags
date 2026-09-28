// SPDX-License-Identifier: GPL-3.0-or-later
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Pango from 'gi://Pango';
import Shell from 'gi://Shell';
import {relativeTime} from '../../search/clipboardProvider.js';

const HOME = GLib.get_home_dir();
const ICON_SIZE = 64;
const THUMB_SIZE = 160;
const FILE_ATTRS = 'standard::icon,standard::content-type,standard::size,standard::type,' +
    'time::modified,thumbnail::path';

function tildify(path) {
    return path.startsWith(HOME) ? `~${path.slice(HOME.length)}` : path;
}

function formatDate(unix) {
    return GLib.DateTime.new_from_unix_local(unix).format('%e %b %Y, %H:%M').trim();
}

export class PreviewPane {
    constructor() {
        this.actor = new St.BoxLayout({
            style_class: 'yags-preview',
            orientation: Clutter.Orientation.VERTICAL,
            y_expand: true,
            visible: false,
        });
        this._current = null;
    }

    show(row, clipboard) {
        if (row === this._current)
            return;
        this._current = row;
        this.actor.destroy_all_children();
        if (!row) {
            this.actor.hide();
            return;
        }

        const {provider, metaInfo: meta} = row;
        const details = [];
        let kind = provider.displayName ?? provider.appInfo?.get_name() ?? '';
        let visual = null;
        let body = meta.description ?? '';

        if (provider.id === 'applications') {
            const app = Shell.AppSystem.get_default().lookup_app(meta.id);
            kind = app ? 'Application' : 'System Action';
            body = app?.get_app_info()?.get_description() ?? '';
            const file = app?.get_app_info()?.get_filename();
            if (file)
                details.push(['Where', tildify(GLib.path_get_dirname(file))]);
        } else if (provider.id === 'yags-files') {
            body = '';
            try {
                const info = Gio.File.new_for_path(meta.id)
                    .query_info(FILE_ATTRS, Gio.FileQueryInfoFlags.NONE, null);
                const isDir = info.get_file_type() === Gio.FileType.DIRECTORY;
                kind = isDir ? 'Folder' : Gio.content_type_get_description(info.get_content_type());
                const thumb = info.get_attribute_byte_string('thumbnail::path');
                if (thumb && GLib.file_test(thumb, GLib.FileTest.EXISTS)) {
                    visual = new St.Icon({
                        style_class: 'yags-preview-thumb',
                        gicon: Gio.FileIcon.new(Gio.File.new_for_path(thumb)),
                        icon_size: THUMB_SIZE,
                    });
                }
                if (!isDir)
                    details.push(['Size', GLib.format_size(info.get_size())]);
                details.push(['Modified', formatDate(info.get_modification_date_time().to_unix())]);
            } catch {}
            details.push(['Where', tildify(GLib.path_get_dirname(meta.id))]);
        } else if (provider.id === 'yags-clipboard') {
            const entry = clipboard?.entry(meta.id);
            kind = entry?.type ?? 'Clipboard';
            body = (entry?.content ?? '').slice(0, 600);
            details.push(['Copied', relativeTime(entry?.datetime)]);
        }

        if (!visual) {
            visual = meta.createIcon?.(ICON_SIZE) ?? null;
            if (visual instanceof St.Icon)
                visual.icon_size = ICON_SIZE;
        }
        if (visual) {
            visual.x_align = Clutter.ActorAlign.CENTER;
            this.actor.add_child(visual);
        }

        this.actor.add_child(this._label('yags-preview-title', meta.name));
        if (kind)
            this.actor.add_child(this._label('yags-preview-kind', kind));
        if (body) {
            const label = this._label(
                provider.id === 'yags-clipboard' ? 'yags-preview-code' : 'yags-preview-body',
                body);
            this.actor.add_child(label);
        }
        if (details.length > 0) {
            this.actor.add_child(new St.Widget({style_class: 'yags-preview-separator'}));
            for (const [key, value] of details) {
                const line = new St.BoxLayout({style_class: 'yags-preview-row'});
                line.add_child(this._label('yags-preview-key', key));
                const val = this._label('yags-preview-value', value);
                val.x_expand = true;
                line.add_child(val);
                this.actor.add_child(line);
            }
        }
        this.actor.show();
    }

    _label(styleClass, text) {
        const label = new St.Label({style_class: styleClass, text: text ?? ''});
        label.clutter_text.set({
            line_wrap: true,
            line_wrap_mode: Pango.WrapMode.WORD_CHAR,
            ellipsize: Pango.EllipsizeMode.NONE,
        });
        return label;
    }

    reset() {
        this._current = null;
        this.actor.destroy_all_children();
        this.actor.hide();
    }

    destroy() {
        this.actor.destroy();
    }
}

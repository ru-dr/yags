// SPDX-License-Identifier: GPL-3.0-or-later
export default class HelloPlugin {
    constructor(api) {
        this.api = api;
    }

    query({query}) {
        const name = query || 'world';
        const text = `${this.api.settings.get('greeting')}, ${name}!`;
        return [{
            title: text,
            subtitle: 'Enter copies it, the button sends a notification',
            icon: 'face-smile-symbolic',
            copy: text,
            activate: {copy: text},
            actions: [{id: 'notify', label: 'Show a notification', icon: 'preferences-system-notifications-symbolic'}],
            preview: {kind: 'Example plugin', body: 'Edit plugin.js in this folder to make it your own.'},
        }];
    }

    activate(result, action) {
        if (action === 'notify')
            this.api.notify('Hello plugin', result.title);
        return null;
    }
}

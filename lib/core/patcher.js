// SPDX-License-Identifier: GPL-3.0-or-later

export class Patcher {
    constructor() {
        this._patches = [];
    }

    replace(target, name, createReplacement) {
        const original = target[name];
        const ownProperty = Object.prototype.hasOwnProperty.call(target, name);
        target[name] = createReplacement(original);
        this._patches.push({target, name, original, ownProperty});
        return original;
    }

    set(target, name, value) {
        return this.replace(target, name, () => value);
    }

    restoreAll() {
        for (const {target, name, original, ownProperty} of this._patches.reverse()) {
            if (ownProperty)
                target[name] = original;
            else
                delete target[name];
        }
        this._patches = [];
    }
}

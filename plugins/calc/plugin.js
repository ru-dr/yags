// SPDX-License-Identifier: GPL-3.0-or-later
import * as E from './engine.js';

const DEV_ICON = 'utilities-terminal-symbolic';

export default class CalculatorPlugin {
    constructor(api) {
        this.api = api;
    }

    query({query, forced}) {
        if (!query)
            return [];
        const base = E.BASE_CONVERSION.exec(query);
        if (base) {
            try {
                const text = E.toBase(E.evaluate(base[1]).value, E.baseOf(base[2]));
                return [this._row(text, `${base[1]} in ${base[2]}`, text.replace(/ /g, ''), DEV_ICON)];
            } catch {
                return [];
            }
        }
        if (!forced && !E.canCalculate(query))
            return [];
        let result;
        try {
            result = E.evaluate(query);
        } catch (e) {
            return forced ? [{title: 'Invalid expression', subtitle: e.message, icon: 'dialog-warning-symbolic'}] : [];
        }
        const {value, usedBase, usedBitwise} = result;
        const text = E.formatNumber(value);
        const rows = [this._row(text, `${query} =`, text)];
        if ((usedBase || usedBitwise) && Number.isInteger(value) && Number.isFinite(value)) {
            for (const [radix, label] of [[16, 'Hex'], [2, 'Binary'], [8, 'Octal']]) {
                const t = E.toBase(value, radix);
                rows.push(this._row(t, label, t.replace(/ /g, ''), DEV_ICON));
            }
        }
        return rows;
    }

    _row(title, subtitle, copy, icon = 'accessories-calculator-symbolic') {
        return {
            title, subtitle, icon, copy,
            activate: {copy},
            preview: {kind: subtitle, body: 'Enter copies the result'},
        };
    }
}

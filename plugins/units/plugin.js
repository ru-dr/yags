// SPDX-License-Identifier: GPL-3.0-or-later
import * as E from '../calc/engine.js';

export default class UnitsPlugin {
    constructor(api) {
        this.api = api;
    }

    query({query}) {
        const m = E.CONVERSION.exec(query);
        if (!m)
            return [];
        let amount;
        try {
            amount = E.evaluate(m[1]).value;
        } catch {
            return [];
        }
        const unit = E.convertUnits(amount, m[2], m[3]);
        if (!unit)
            return [];
        const text = E.formatGrouped(unit.value, 6);
        const copy = E.formatNumber(Number(unit.value.toPrecision(12)));
        const subtitle = `${E.formatGrouped(amount, 6)} ${unit.from} = ${text} ${unit.to} · ${unit.category}`;
        return [{
            title: `${text} ${unit.to}`, subtitle, copy,
            icon: 'accessories-calculator-symbolic',
            activate: {copy},
            preview: {kind: `${unit.category[0].toUpperCase()}${unit.category.slice(1)}`, body: subtitle},
        }];
    }
}

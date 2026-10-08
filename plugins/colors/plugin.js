// SPDX-License-Identifier: GPL-3.0-or-later
import * as Color from './color.js';

function grade(x) {
    return x >= 7 ? 'AAA' : x >= 4.5 ? 'AA' : x >= 3 ? 'AA large' : 'fail';
}

export default class ColorsPlugin {
    constructor(api) {
        this.api = api;
    }

    query({query}) {
        if (!/^(#|rgba?\(|hsla?\()/i.test(query.trim()))
            return [];
        const c = Color.parseColor(query);
        if (!c)
            return [];
        const hex = Color.toHex({...c, a: 1});
        const formats = Color.colorFormats(c);
        const white = Color.contrast(c, {r: 255, g: 255, b: 255});
        const black = Color.contrast(c, {r: 0, g: 0, b: 0});
        const preview = {
            kind: 'Color',
            title: Color.toHex(c),
            swatches: Color.spectrum(c).map((s, i) => ({color: Color.toHex(s), base: i === 2})),
            details: [
                ...formats,
                ['On white', `${white.toFixed(2)}:1 · ${grade(white)}`],
                ['On black', `${black.toFixed(2)}:1 · ${grade(black)}`],
                ['Luminance', Color.luminance(c).toFixed(3)],
            ],
        };
        return formats.map(([kind, value]) => ({
            title: value, subtitle: kind, icon: {color: hex}, copy: value, activate: {copy: value}, preview,
        }));
    }
}

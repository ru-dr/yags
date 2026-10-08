// SPDX-License-Identifier: GPL-3.0-or-later
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildCss} from '../lib/core/css.js';

const config = (overrides = {}) => ({
    style: 'mac', accentColor: '#ff375f', opacity: 90, cornerRadius: 10, fontSize: 20, ...overrides,
});

test('every declaration is important so user settings win', () => {
    const css = buildCss(config());
    const declarations = css.match(/:\s*[^;{}]+;/g) ?? [];
    assert.ok(declarations.length > 10);
    assert.ok(declarations.every(d => d.includes('!important')));
});

test('applies accent, radius and opacity', () => {
    const css = buildCss(config());
    assert.match(css, /rgb\(255, 55, 95\)/);
    assert.match(css, /\.yags-results \{ border-radius: 10px !important; \}/);
    assert.match(css, /rgba\(36, 36, 38, 0\.9\)/);
});

test('each style is scoped to its own class', () => {
    assert.match(buildCss(config({style: 'powertoys'})), /\.yags-style-powertoys/);
    assert.doesNotMatch(buildCss(config({style: 'powertoys'})), /\.yags-style-mac/);
});

test('falls back to the default accent for invalid colours', () => {
    assert.match(buildCss(config({accentColor: 'nope'})), /rgb\(10, 132, 255\)/);
});

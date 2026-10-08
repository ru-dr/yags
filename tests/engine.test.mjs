// SPDX-License-Identifier: GPL-3.0-or-later
import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../plugins/calc/engine.js';

const value = expression => E.evaluate(expression).value;

test('arithmetic and precedence', () => {
    assert.equal(value('2+2*3'), 8);
    assert.equal(value('(1+2)*3'), 9);
    assert.equal(value('2^10'), 1024);
    assert.equal(value('2**0.5'), Math.SQRT2);
    assert.equal(value('17 // 5'), 3);
    assert.equal(value('-7 % 3'), 2);
    assert.equal(value('5!'), 120);
});

test('functions and constants', () => {
    assert.equal(value('sqrt(16)'), 4);
    assert.equal(value('sqrt 16'), 4);
    assert.equal(value('log(8, 2)'), 3);
    assert.ok(Math.abs(value('2pi') - 2 * Math.PI) < 1e-12);
    assert.equal(value('max(1, 9, 3)'), 9);
});

test('bases and bitwise', () => {
    assert.equal(value('0xff | 0b1'), 255);
    assert.equal(value('7 xor 3'), 4);
    assert.equal(value('1 << 16'), 65536);
    assert.equal(E.toBase(255, 16), '0xFF');
    assert.equal(E.toBase(10, 2), '0b1010');
    assert.throws(() => value('1 << 100000'));
    assert.throws(() => value('3 & 1.5'));
});

test('only calculates things that look like math', () => {
    for (const text of ['2+2', '2pi', 'sqrt 2', '0x1f', '(1+2)*3', 'log 100'])
        assert.ok(E.canCalculate(text), text);
    for (const text of ['2024', 'firefox', 'windows 11', '11 22', '10 km to mi', '2024-01-01', 'log out', 'e', 'pi'])
        assert.ok(!E.canCalculate(text), text);
});

test('unit conversion', () => {
    const km = E.convertUnits(10, 'km', 'mi');
    assert.ok(Math.abs(km.value - 6.213712) < 1e-6);
    assert.equal(km.category, 'length');
    assert.ok(Math.abs(E.convertUnits(100, 'f', 'c').value - 37.777778) < 1e-5);
    assert.equal(E.convertUnits(1, 'GiB', 'MiB').value, 1024);
    assert.equal(E.convertUnits(1, 'km', 'kg'), null);
});

test('number formatting', () => {
    assert.equal(E.formatNumber(0.1 + 0.2), '0.3');
    assert.equal(E.formatNumber(1 / 0), '∞');
    assert.equal(E.formatGrouped(1234567.891, 2), '1,234,567.89');
});

// SPDX-License-Identifier: GPL-3.0-or-later

const FUNCS = {
    sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, exp: Math.exp,
    sin: Math.sin, cos: Math.cos, tan: Math.tan,
    asin: Math.asin, acos: Math.acos, atan: Math.atan, atan2: Math.atan2,
    sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
    ln: Math.log, log2: Math.log2, log10: Math.log10,
    log: (x, b) => b === undefined ? Math.log10(x) : Math.log(x) / Math.log(b),
    floor: Math.floor, ceil: Math.ceil, round: Math.round, trunc: Math.trunc, sign: Math.sign,
    min: Math.min, max: Math.max, pow: Math.pow, hypot: Math.hypot,
    deg: x => x * 180 / Math.PI, rad: x => x * Math.PI / 180,
    fact: x => factorial(x),
    gcd: (a, b) => gcd(a, b),
    lcm: (a, b) => Math.abs(a * b) / gcd(a, b),
    avg: (...xs) => xs.reduce((s, x) => s + x, 0) / xs.length,
    sum: (...xs) => xs.reduce((s, x) => s + x, 0),
};
const CONSTS = {pi: Math.PI, 'π': Math.PI, e: Math.E, tau: 2 * Math.PI, phi: (1 + Math.sqrt(5)) / 2};

function gcd(a, b) {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b) [a, b] = [b, a % b];
    return a;
}

function factorial(x) {
    if (!Number.isInteger(x) || x < 0 || x > 170)
        throw new Error('factorial needs a whole number from 0 to 170');
    let r = 1;
    for (let i = 2; i <= x; i++)
        r *= i;
    return r;
}

const TOKEN = /\s*(0x[0-9a-f_]+|0b[01_]+|0o[0-7_]+|(?:\d[\d_]*\.?\d*|\.\d+)(?:e[+-]?\d+)?|\*\*|<<|>>|\/\/|[a-zπ_][a-z0-9_]*|[-+*/%^&|~(),!])/iy;

function tokenize(src) {
    const out = [];
    TOKEN.lastIndex = 0;
    let pos = 0;
    while (pos < src.length) {
        if (/^\s*$/.test(src.slice(pos)))
            break;
        TOKEN.lastIndex = pos;
        const m = TOKEN.exec(src);
        if (!m)
            throw new Error(`unexpected "${src.slice(pos).trim()[0]}"`);
        out.push(m[1]);
        pos = TOKEN.lastIndex;
    }
    return out;
}

function parseNumber(tok) {
    const t = tok.replace(/_/g, '').toLowerCase();
    if (t.startsWith('0x'))
        return {value: parseInt(t.slice(2), 16), base: 16};
    if (t.startsWith('0b'))
        return {value: parseInt(t.slice(2), 2), base: 2};
    if (t.startsWith('0o'))
        return {value: parseInt(t.slice(2), 8), base: 8};
    return {value: Number(t), base: 10};
}

function toBig(x) {
    if (!Number.isInteger(x))
        throw new Error('bitwise operators need whole numbers');
    return BigInt(x);
}

class Parser {
    constructor(tokens) {
        this.t = tokens;
        this.i = 0;
        this.usedBase = false;
        this.usedBitwise = false;
    }

    peek() {
        return this.t[this.i]?.toLowerCase();
    }

    next() {
        return this.t[this.i++];
    }

    expect(tok) {
        if (this.peek() !== tok)
            throw new Error(`expected "${tok}"`);
        this.i++;
    }

    parse() {
        const v = this.bitor();
        if (this.i < this.t.length)
            throw new Error(`unexpected "${this.t[this.i]}"`);
        return v;
    }

    bitor() {
        let v = this.bitxor();
        while (this.peek() === '|') {
            this.next();
            this.usedBitwise = true;
            v = Number(toBig(v) | toBig(this.bitxor()));
        }
        return v;
    }

    bitxor() {
        let v = this.bitand();
        while (this.peek() === 'xor') {
            this.next();
            this.usedBitwise = true;
            v = Number(toBig(v) ^ toBig(this.bitand()));
        }
        return v;
    }

    bitand() {
        let v = this.shift();
        while (this.peek() === '&') {
            this.next();
            this.usedBitwise = true;
            v = Number(toBig(v) & toBig(this.shift()));
        }
        return v;
    }

    shift() {
        let v = this.add();
        while (this.peek() === '<<' || this.peek() === '>>') {
            const op = this.next();
            this.usedBitwise = true;
            const r = toBig(this.add());
            if (r < 0n || r > 1024n)
                throw new Error('shift amount must be 0 to 1024');
            v = Number(op === '<<' ? toBig(v) << r : toBig(v) >> r);
        }
        return v;
    }

    add() {
        let v = this.mul();
        while (this.peek() === '+' || this.peek() === '-') {
            const op = this.next();
            const r = this.mul();
            v = op === '+' ? v + r : v - r;
        }
        return v;
    }

    mul() {
        let v = this.unary();
        for (;;) {
            const p = this.peek();
            if (p === '*' || p === '/' || p === '%' || p === '//' || p === 'mod') {
                this.next();
                const r = this.unary();
                if (p === '*')
                    v *= r;
                else if (p === '/')
                    v /= r;
                else if (p === '//')
                    v = Math.floor(v / r);
                else
                    v = ((v % r) + r) % r;
            } else if (p !== undefined && (p === '(' || /^[a-zπ]/.test(p)) && !['xor', 'mod'].includes(p)) {
                v *= this.unary();
            } else {
                return v;
            }
        }
    }

    unary() {
        const p = this.peek();
        if (p === '-') {
            this.next();
            return -this.unary();
        }
        if (p === '+') {
            this.next();
            return this.unary();
        }
        if (p === '~') {
            this.next();
            this.usedBitwise = true;
            return Number(~toBig(this.unary()));
        }
        return this.power();
    }

    power() {
        const base = this.postfix();
        if (this.peek() === '^' || this.peek() === '**') {
            this.next();
            return base ** this.unary();
        }
        return base;
    }

    postfix() {
        let v = this.primary();
        while (this.peek() === '!') {
            this.next();
            v = factorial(v);
        }
        return v;
    }

    primary() {
        const tok = this.next();
        if (tok === undefined)
            throw new Error('incomplete expression');
        const low = tok.toLowerCase();
        if (low === '(') {
            const v = this.bitor();
            this.expect(')');
            return v;
        }
        if (/^[\d.]/.test(low)) {
            const n = parseNumber(tok);
            if (n.base !== 10)
                this.usedBase = true;
            if (Number.isNaN(n.value))
                throw new Error(`bad number ${tok}`);
            return n.value;
        }
        if (low in FUNCS && this.peek() !== undefined && this.peek() !== '(' && /^[\d.a-zπ]/.test(this.peek()))
            return FUNCS[low](this.unary());
        if (low in FUNCS && this.peek() === '(') {
            this.next();
            const args = [];
            if (this.peek() !== ')') {
                args.push(this.bitor());
                while (this.peek() === ',') {
                    this.next();
                    args.push(this.bitor());
                }
            }
            this.expect(')');
            return FUNCS[low](...args);
        }
        if (low in CONSTS)
            return CONSTS[low];
        throw new Error(`unknown "${tok}"`);
    }
}

export function evaluate(src) {
    const p = new Parser(tokenize(src));
    const value = p.parse();
    return {value, usedBase: p.usedBase, usedBitwise: p.usedBitwise};
}

const PLAIN_NUMBER = /^[\d.,_\s]+$/;
const FUNCTION_CALL = /\b[a-z][a-z0-9]*\s*\(|\b(?:sqrt|cbrt|sin|cos|tan|ln|log|log2|log10|exp|abs|fact)\s+[\d.(a-zπ]/i;

export function canCalculate(src) {
    const text = src.trim();
    if (!text || PLAIN_NUMBER.test(text) || /^\d{4}-\d{2}-\d{2}/.test(text))
        return false;
    if (!/\d/.test(text) && !FUNCTION_CALL.test(text))
        return false;
    try {
        return Number.isFinite(evaluate(text).value) || /\/\s*0/.test(text);
    } catch {
        return false;
    }
}

export function formatNumber(x) {
    if (!Number.isFinite(x))
        return Number.isNaN(x) ? 'Not a number' : (x > 0 ? '∞' : '-∞');
    if (x !== 0 && (Math.abs(x) >= 1e21 || Math.abs(x) < 1e-9))
        return x.toExponential(10).replace(/\.?0+e/, 'e');
    return String(Number(x.toPrecision(15)));
}

export function formatGrouped(x, digits = 10) {
    if (!Number.isFinite(x) || Math.abs(x) >= 1e21)
        return formatNumber(x);
    return x.toLocaleString('en-US', {maximumFractionDigits: digits});
}

export function toBase(x, base) {
    const n = toBig(Math.trunc(x));
    const neg = n < 0n;
    const abs = neg ? -n : n;
    const prefix = {16: '0x', 2: '0b', 8: '0o', 10: ''}[base];
    let digits = abs.toString(base);
    if (base === 16)
        digits = digits.toUpperCase();
    if (base === 2)
        digits = digits.padStart(Math.ceil(digits.length / 4) * 4, '0').replace(/(.{4})(?=.)/g, '$1 ');
    return `${neg ? '-' : ''}${prefix}${digits}`;
}

const UNIT_DEFS = {
    length: {
        base: 'm',
        units: {
            mm: [0.001, 'millimeter', 'millimeters', 'millimetre', 'millimetres'],
            cm: [0.01, 'centimeter', 'centimeters', 'centimetre', 'centimetres'],
            m: [1, 'meter', 'meters', 'metre', 'metres'],
            km: [1000, 'kilometer', 'kilometers', 'kilometre', 'kilometres'],
            in: [0.0254, 'inch', 'inches', '"'],
            ft: [0.3048, 'foot', 'feet', "'"],
            yd: [0.9144, 'yard', 'yards'],
            mi: [1609.344, 'mile', 'miles'],
            nmi: [1852, 'nauticalmile', 'nauticalmiles'],
            µm: [1e-6, 'um', 'micrometer', 'micrometers', 'micron', 'microns'],
            nm: [1e-9, 'nanometer', 'nanometers'],
        },
    },
    mass: {
        base: 'kg',
        units: {
            mg: [1e-6, 'milligram', 'milligrams'],
            g: [0.001, 'gram', 'grams'],
            kg: [1, 'kilogram', 'kilograms', 'kilo', 'kilos'],
            t: [1000, 'tonne', 'tonnes', 'ton', 'tons'],
            oz: [0.028349523125, 'ounce', 'ounces'],
            lb: [0.45359237, 'lbs', 'pound', 'pounds'],
            st: [6.35029318, 'stone', 'stones'],
        },
    },
    volume: {
        base: 'l',
        units: {
            ml: [0.001, 'milliliter', 'milliliters', 'millilitre', 'millilitres'],
            cl: [0.01, 'centiliter', 'centiliters'],
            dl: [0.1, 'deciliter', 'deciliters'],
            l: [1, 'liter', 'liters', 'litre', 'litres'],
            m3: [1000, 'm³', 'cubicmeter', 'cubicmeters'],
            gal: [3.785411784, 'gallon', 'gallons'],
            qt: [0.946352946, 'quart', 'quarts'],
            pt: [0.473176473, 'pint', 'pints'],
            cup: [0.2365882365, 'cups'],
            floz: [0.0295735295625, 'fl_oz', 'fluidounce', 'fluidounces'],
            tbsp: [0.01478676478125, 'tablespoon', 'tablespoons'],
            tsp: [0.00492892159375, 'teaspoon', 'teaspoons'],
        },
    },
    area: {
        base: 'm2',
        units: {
            mm2: [1e-6, 'mm²'],
            cm2: [1e-4, 'cm²'],
            m2: [1, 'm²', 'sqm'],
            km2: [1e6, 'km²'],
            ha: [1e4, 'hectare', 'hectares'],
            acre: [4046.8564224, 'acres', 'ac'],
            ft2: [0.09290304, 'ft²', 'sqft'],
            in2: [0.00064516, 'in²', 'sqin'],
            mi2: [2589988.110336, 'mi²', 'sqmi'],
        },
    },
    time: {
        base: 's',
        units: {
            ns: [1e-9, 'nanosecond', 'nanoseconds'],
            µs: [1e-6, 'us', 'microsecond', 'microseconds'],
            ms: [0.001, 'millisecond', 'milliseconds'],
            s: [1, 'sec', 'secs', 'second', 'seconds'],
            min: [60, 'mins', 'minute', 'minutes'],
            h: [3600, 'hr', 'hrs', 'hour', 'hours'],
            d: [86400, 'day', 'days'],
            wk: [604800, 'week', 'weeks'],
            mo: [2629746, 'month', 'months'],
            yr: [31556952, 'year', 'years', 'y'],
        },
    },
    speed: {
        base: 'm/s',
        units: {
            'm/s': [1, 'mps'],
            'km/h': [1 / 3.6, 'kmh', 'kph'],
            mph: [0.44704],
            knot: [0.514444, 'knots', 'kn', 'kt'],
            'ft/s': [0.3048, 'fps'],
        },
    },
    data: {
        base: 'B',
        caseSensitive: true,
        units: {
            bit: [0.125, 'bits', 'b'],
            B: [1, 'byte', 'bytes'],
            KB: [1e3, 'kB', 'kb', 'kilobyte', 'kilobytes'],
            MB: [1e6, 'mb', 'megabyte', 'megabytes'],
            GB: [1e9, 'gb', 'gigabyte', 'gigabytes'],
            TB: [1e12, 'tb', 'terabyte', 'terabytes'],
            PB: [1e15, 'pb', 'petabyte', 'petabytes'],
            KiB: [1024, 'kib', 'kibibyte', 'kibibytes'],
            MiB: [1024 ** 2, 'mib', 'mebibyte', 'mebibytes'],
            GiB: [1024 ** 3, 'gib', 'gibibyte', 'gibibytes'],
            TiB: [1024 ** 4, 'tib', 'tebibyte', 'tebibytes'],
            Kb: [125, 'kbit', 'kilobit', 'kilobits'],
            Mb: [125e3, 'mbit', 'megabit', 'megabits'],
            Gb: [125e6, 'gbit', 'gigabit', 'gigabits'],
        },
    },
    pressure: {
        base: 'Pa',
        units: {
            Pa: [1, 'pa', 'pascal', 'pascals'],
            kPa: [1000, 'kpa'],
            bar: [1e5, 'bars'],
            atm: [101325],
            psi: [6894.757293168],
            mmHg: [133.322387415, 'mmhg', 'torr'],
        },
    },
    energy: {
        base: 'J',
        units: {
            J: [1, 'j', 'joule', 'joules'],
            kJ: [1000, 'kj', 'kilojoule', 'kilojoules'],
            cal: [4.184, 'calorie', 'calories'],
            kcal: [4184, 'kilocalorie', 'kilocalories', 'Cal'],
            Wh: [3600, 'wh'],
            kWh: [3.6e6, 'kwh'],
            eV: [1.602176634e-19, 'ev', 'electronvolt'],
        },
    },
    angle: {
        base: 'rad',
        units: {
            rad: [1, 'radian', 'radians'],
            deg: [Math.PI / 180, '°', 'degree', 'degrees'],
            grad: [Math.PI / 200, 'gradian', 'gradians', 'gon'],
            turn: [2 * Math.PI, 'turns', 'rev', 'revolution'],
        },
    },
    temperature: {
        base: 'K',
        units: {
            C: [null, '°c', 'c', 'celsius', 'degc'],
            F: [null, '°f', 'f', 'fahrenheit', 'degf'],
            K: [null, 'k', 'kelvin', 'kelvins'],
        },
    },
};

const UNITS = new Map();
const UNITS_CI = new Map();
for (const [category, def] of Object.entries(UNIT_DEFS)) {
    for (const [symbol, [factor, ...aliases]] of Object.entries(def.units)) {
        const entry = {category, symbol, factor};
        for (const name of [symbol, ...aliases]) {
            if (def.caseSensitive)
                UNITS.set(name, entry);
            else
                UNITS_CI.set(name.toLowerCase(), entry);
        }
    }
}

export function lookupUnit(name) {
    return UNITS.get(name) ?? UNITS_CI.get(name.toLowerCase()) ?? null;
}

function toKelvin(v, s) {
    return s === 'C' ? v + 273.15 : s === 'F' ? (v - 32) * 5 / 9 + 273.15 : v;
}

function fromKelvin(v, s) {
    return s === 'C' ? v - 273.15 : s === 'F' ? (v - 273.15) * 9 / 5 + 32 : v;
}

export function convertUnits(value, from, to) {
    const a = lookupUnit(from);
    const b = lookupUnit(to);
    if (!a || !b || a.category !== b.category)
        return null;
    const result = a.category === 'temperature'
        ? fromKelvin(toKelvin(value, a.symbol), b.symbol)
        : value * a.factor / b.factor;
    return {value: result, from: a.symbol, to: b.symbol, category: a.category};
}

export const CONVERSION = /^\s*(.+?)\s*([a-zA-Zµ°$€£¥₹"'][a-zA-Zµ°²³$€£¥₹"'/_0-9]*)\s+(?:to|in|as|into|=|->)\s+([a-zA-Zµ°$€£¥₹][a-zA-Zµ°²³$€£¥₹/_0-9]*)\s*$/;
export const BASE_CONVERSION = /^\s*(.+?)\s+(?:to|in|as)\s+(hex|hexadecimal|bin|binary|oct|octal|dec|decimal)\s*$/i;

export function baseOf(name) {
    return {hex: 16, hexadecimal: 16, bin: 2, binary: 2, oct: 8, octal: 8, dec: 10, decimal: 10}[name.toLowerCase()];
}

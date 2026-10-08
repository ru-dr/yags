// SPDX-License-Identifier: GPL-3.0-or-later

const SELECTED_STATES = [':selected', ':focus', ':selected:hover', ':focus:hover'];

function parseHex(hex) {
    const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    const value = parseInt(match ? match[1] : '0a84ff', 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function important(css) {
    return css.replace(/:\s*([^;{}]+?)\s*(!important)?\s*;/g, ': $1 !important;');
}

function selectors(scopes, suffixes) {
    return scopes.flatMap(scope => suffixes.map(suffix => `${scope}${suffix}`)).join(', ');
}

function commonRules(look) {
    const {dark, light, accent, rgb, font} = look;
    const entries = selectors([dark, light], [' .yags-bar StEntry', ' .yags-bar StEntry:hover', ' .yags-bar StEntry:focus']);
    return `
${entries} { caret-color: ${accent}; selection-background-color: rgba(${rgb}, 0.4); font-size: ${font}px; }
${dark} .yags-ghost { font-size: ${font}px; }
${selectors([dark, light], [' .yags-filter-button:checked'])} { background-color: ${accent}; }
`;
}

function macRules(look) {
    const {dark, light, accent, alpha, radius, font} = look;
    const line = Math.max(34, Math.round(font * 1.5));
    const bar = Math.min(Math.round((line + 24) / 2), radius + 3);
    const entries = selectors([dark, light], [' .yags-bar StEntry', ' .yags-bar StEntry:hover', ' .yags-bar StEntry:focus']);
    const selected = selectors([dark, light], SELECTED_STATES.map(s => ` .list-search-result${s}`));
    return `
${dark} .yags-bar, ${dark} .yags-results { background-color: rgba(36, 36, 38, ${alpha}); }
${light} .yags-bar, ${light} .yags-results { background-color: rgba(248, 248, 250, ${alpha}); }
${dark} .yags-results { border-radius: ${radius}px; }
${dark} .yags-bar { border-radius: ${bar}px; }
${entries} { min-height: ${line}px; }
${dark} .list-search-result { border-radius: ${Math.round(radius * 0.4)}px; }
${dark} .yags-preview { border-radius: ${Math.round(radius * 0.7)}px; }
${dark} .yags-filter-button { border-radius: ${Math.round(bar * 0.55)}px; }
${selected} { background-color: ${accent}; }
`;
}

export const ROOT = '.yags-container.yags-custom';
export const USER_ROOT = `${ROOT}.yags-user`;

export function buildCss(config) {
    const rgb = parseHex(config.accentColor).join(', ');
    const look = {
        dark: ROOT,
        light: `${ROOT}.theme-light`,
        rgb,
        accent: `rgb(${rgb})`,
        alpha: config.opacity / 100,
        radius: config.cornerRadius,
        font: config.fontSize,
    };
    return important(commonRules(look) + macRules(look));
}

function scopeSelector(selector) {
    const s = selector.trim();
    if (!s)
        return null;
    const rest = s.replace(/^\.yags-container\b/, '');
    if (rest !== s || s.startsWith('.theme-light') || s.startsWith(':'))
        return `${USER_ROOT}${rest}`;
    return `${USER_ROOT} ${s}`;
}

export function scopeUserCss(text) {
    const css = text.replace(/\/\*[\s\S]*?\*\//g, '');
    const rules = [];
    for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const scoped = match[1].split(',').map(scopeSelector).filter(Boolean);
        const body = match[2].trim();
        if (scoped.length > 0 && body)
            rules.push(`${scoped.join(', ')} { ${body.endsWith(';') ? body : `${body};`} }`);
    }
    return important(rules.join('\n'));
}

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

function powertoysRules(look) {
    const {dark, light, accent, alpha, radius, font} = look;
    const frame = Math.round(radius * 0.3);
    const inner = Math.max(frame - 2, 0);
    const small = Math.max(frame - 4, 0);
    const line = Math.max(30, Math.round(font * 1.5));
    const entries = selectors([dark, light], [' .yags-bar StEntry', ' .yags-bar StEntry:hover', ' .yags-bar StEntry:focus']);
    return `
${dark} { background-color: rgba(32, 32, 32, ${alpha}); border-radius: ${frame}px; }
${light} { background-color: rgba(243, 243, 243, ${alpha}); }
${dark} .yags-bar { border-radius: ${inner}px; }
${entries} { min-height: ${line}px; }
${dark} .list-search-result, ${dark} .yags-preview { border-radius: ${inner}px; }
${dark} .yags-row-action, ${dark} .yags-filter-button { border-radius: ${small}px; }
${dark} .yags-bar-underline { background-color: ${accent}; }
${selectors([dark], [' .list-search-result:selected .yags-row-indicator', ' .list-search-result:focus .yags-row-indicator'])} { background-color: ${accent}; }
`;
}

const STYLE_RULES = {mac: macRules, powertoys: powertoysRules};

export function buildCss(config) {
    const dark = `.yags-container.yags-custom.yags-style-${config.style}`;
    const rgb = parseHex(config.accentColor).join(', ');
    const look = {
        dark,
        light: `${dark}.theme-light`,
        rgb,
        accent: `rgb(${rgb})`,
        alpha: config.opacity / 100,
        radius: config.cornerRadius,
        font: config.fontSize,
    };
    const rules = STYLE_RULES[config.style] ?? macRules;
    return important(commonRules(look) + rules(look));
}

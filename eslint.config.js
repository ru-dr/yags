// SPDX-License-Identifier: GPL-3.0-or-later
import js from '@eslint/js';

const gjsGlobals = {
    global: 'readonly',
    console: 'readonly',
    log: 'readonly',
    logError: 'readonly',
    print: 'readonly',
    TextEncoder: 'readonly',
    TextDecoder: 'readonly',
    setTimeout: 'readonly',
    clearTimeout: 'readonly',
};

export default [
    js.configs.recommended,
    {
        files: ['**/*.js', '**/*.mjs'],
        languageOptions: {ecmaVersion: 2024, sourceType: 'module', globals: gjsGlobals},
        rules: {
            'indent': ['error', 4, {
                SwitchCase: 0,
                ignoredNodes: ['CallExpression[callee.object.name=GObject][callee.property.name=registerClass] > ClassExpression:first-child'],
            }],
            'quotes': ['error', 'single', {avoidEscape: true, allowTemplateLiterals: true}],
            'semi': ['error', 'always'],
            'comma-dangle': ['error', 'always-multiline'],
            'eqeqeq': ['error', 'always'],
            'prefer-const': 'error',
            'no-var': 'error',
            'no-unused-vars': ['error', {argsIgnorePattern: '^_', varsIgnorePattern: '^_'}],
            'no-empty': ['error', {allowEmptyCatch: true}],
            'object-curly-spacing': ['error', 'never'],
            'arrow-parens': ['error', 'as-needed'],
            'max-len': ['error', {code: 140, ignoreStrings: true, ignoreTemplateLiterals: true, ignoreRegExpLiterals: true}],
        },
    },
    {
        files: ['tests/**/*.mjs'],
        languageOptions: {globals: {process: 'readonly'}},
    },
];

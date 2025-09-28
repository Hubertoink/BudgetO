/* eslint-env node */
module.exports = {
    root: true,
    env: { browser: true, es2022: true, node: true },
    parser: '@typescript-eslint/parser',
    parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    plugins: ['@typescript-eslint', 'react-refresh'],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',

        'prettier'
    ],
    settings: { react: { version: 'detect' } },
    ignorePatterns: ['dist', 'dist-electron', 'release', 'node_modules'],
    rules: {
        'react-refresh/only-export-components': 'warn'
    }
}

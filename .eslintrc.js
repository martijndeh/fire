module.exports = {
    root: true,
    parser: 'babel-eslint',
    env: {
        node: true,
        browser: true,
        jest: true,
    },
    extends: [
        'airbnb',
        'eslint:recommended',
    ],
    globals: {
        fetch: true,
    },
    rules: {
        'react/prop-types': 0,
        'react/jsx-filename-extension': 0,
        // This doesn't work well with async-await.
        'react/no-did-mount-set-state': 0,
        'react/jsx-indent': [2, 4],
        // Ideally, we use extension for internal modules and no extensions for external modules, but
        // this isn't configurable currently.
        'import/extensions': 0,
        'react/prefer-stateless-function': 0,
        'jsx-quotes': [2, 'prefer-double'],
        'quotes': [2, 'backtick'],
    },
};

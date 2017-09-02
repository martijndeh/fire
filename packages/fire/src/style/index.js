import classNames from 'classnames';
import injectSheet from 'react-jss';

let theme = {};

export function setTheme(newTheme) {
    theme = newTheme;
}

export function getTheme() {
    return theme;
}

const style = (classes) => (Component) => {
    return injectSheet(classes)(Component);
};

export {
    classNames,
    style,
};

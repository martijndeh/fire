import classNames from 'classnames';
import injectSheet from 'react-jss';
import { setComponent } from '../component/index.js';

let theme = {};

export function setTheme(newTheme) {
    theme = newTheme;
}

export function getTheme() {
    return theme;
}

const style = (classes) => (Component) => {
    const NewComponent = injectSheet(classes)(Component);
    setComponent(Component, NewComponent);
    return NewComponent;
};

export {
    classNames,
    style,
};

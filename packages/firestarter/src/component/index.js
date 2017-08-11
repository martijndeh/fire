import React from 'react';

const components = {};

export function isComponent(Entity) {
    return (Entity && Entity.prototype && !!Entity.prototype.isReactComponent);
}

export function setComponent(OldComponent, NewComponent) {
    console.log(`setComponent`);

    // TODO: Create a proper index so we don't have to loop.
    const paths = Object.keys(components).filter((path) => components[path].Component === OldComponent);

    console.log(`Replacing in: ${paths}`);

    paths.forEach((path) => {
        components[path].Component = NewComponent;
    });
}

export function getComponents() {
    return components;
}

export default function component(path: string, props = {}) {
    return (Component) => {
        if (!isComponent(Component)) {
            throw new Error(`Target in @component(\`${path}\`) is not a React.Component. Did you forget to extend from React.Component?`);
        }

        components[path] = {
            Component,
            props,
        };
        return Component;
    };
}

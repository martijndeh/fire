import React from 'react';
import { observer } from 'mobx-react';
import { registerInjectProvider } from '../injector/index.js';

// FIXME: Ideally we don't have module state like this.
const components = {};

export function getPathForErrorCode(errorCode) {
    const path = Object.keys(components).find((path) => {
        const {
            props,
        } = components[path];

        if (props.error) {
            return Array.isArray(props.error) && props.error.indexof(errorCode) !== -1 || props.error === errorCode;
        }
    });
    return path;
}

export function isComponent(Entity) {
    return (Entity && Entity.prototype && !!Entity.prototype.isReactComponent);
}

function setComponent(OldComponent, NewComponent) {
    // TODO: Create a proper index so we don't have to loop.
    const paths = Object.keys(components).filter((path) => components[path].Component === OldComponent);

    console.log(`Replace old component with newly wrapped component`);

    paths.forEach((path) => {
        components[path].Component = NewComponent;
    });
}

registerInjectProvider((instance, propertyName, Class) => {
    if (isComponent(Class)) {
        const ObserverComponent = observer(Class);

        class WrappedComponent extends React.Component {
            render() {
                return (
                    <ObserverComponent {...this.props} {...{[propertyName]: instance}} />
                );
            }
        }

        // This is a bit hacky. But we replace the currently set component.
        setComponent(Class, WrappedComponent);

        return WrappedComponent;
    }

    return Class;
});


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

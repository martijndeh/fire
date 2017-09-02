import React from 'react';
import { observer as mobxObserver } from 'mobx-react';
import { addInjectProvider } from '../injector/index.js';

export function observer(Class) {
    if (!isComponent(Class)) {
        throw new Error(`@observer must be called on a React.Component`);
    }

    return mobxObserver(Class);
}

export function isComponent(Entity) {
    return (Entity && Entity.prototype && !!Entity.prototype.isReactComponent);
}

addInjectProvider((instance, propertyName, Class) => {
    if (isComponent(Class)) {
        // TODO: Maybe check if this is already an observer?
        const ObserverComponent = mobxObserver(Class);

        class WrappedComponent extends React.Component {
            render() {
                return (
                    <ObserverComponent {...this.props} {...{[propertyName]: instance}} />
                );
            }
        }

        return WrappedComponent;
    }

    return Class;
});

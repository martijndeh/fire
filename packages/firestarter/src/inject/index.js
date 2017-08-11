import React from 'react';
import { observer } from 'mobx-react';
import { isComponent, setComponent } from '../component/index.js';
import { getService, createService, setService } from '../service/index.js';
import { getStore, createStore, setStore } from '../store/index.js';

const instances = {};

function getEntityName(Entity) {
    return Entity.displayName || Entity.name;
}

function getEntityType(Entity) {
    if (isComponent(Entity)) {
        return `component`;
    }
    else {
        const entityName = getEntityName(Entity);

        if (getStore(entityName)) {
            return `store`;
        }
        else if (getService(entityName)) {
            return `service`;
        }
    }

    return `unknown`;
}

function createEntityInstance(entityType, Entity) {
    switch (entityType) {
        case `store`:
            return createStore(Entity);

        case `service`:
            return createService(Entity);

        case `component`:
            throw new Error(`You're trying to inject a React.Component in another entity. This is not supported.`);

        default:
            return new Entity();
    }
}

function getEntityInstance(Entity) {
    const entityName = Entity.displayName || Entity.name;
    const entityType = getEntityType(Entity);
    const instanceName = `${entityName}${entityType}`;

    let instance = instances[instanceName];
    if (!instance) {
        instance = createEntityInstance(entityType, Entity);
        instances[instanceName] = instance;
    }

    return instance;
}

function injectInComponent(injectedEntity, propertyName, Component) {
    console.log(`inject ${propertyName} in component`);

    const ObserverComponent = observer(Component);

    class WrappedComponent extends React.Component {
        render() {
            return (
                <ObserverComponent {...this.props} {...{[propertyName]: injectedEntity}} />
            );
        }
    }

    setComponent(Component, WrappedComponent);

    return WrappedComponent;
}

function replaceClass(OldClass, NewClass) {
    const className = getEntityName(OldClass);

    if (getStore(className)) {
        setStore(className, NewClass);
    }
    else if (getService(className)) {
        setService(className, NewClass);
    }
    else {
        // This is an unknown. Not important at this point.
    }
}

function injectInClass(injectedEntity, propertyName, Class) {
    class ClassWrapper extends Class {
        constructor() {
            super();

            this[propertyName] = injectedEntity;
        }
    }
    ClassWrapper.WrappedComponent = Class;
    ClassWrapper.OriginalClass = Class.OriginalClass || Class;
    ClassWrapper.displayName = Class.name;

    replaceClass(Class, ClassWrapper);

    return ClassWrapper;
}

export default function inject(InjectedEntity, propertyName) {
    return (Entity) => {
        const injectedEntity = getEntityInstance(InjectedEntity);
        const entityType = getEntityType(Entity);

        console.log(`Inject ${propertyName} in ${entityType} (${React.Component.isPrototypeOf(Entity)})`);
        console.log(Entity);

        switch (entityType) {
            case `component`:
                return injectInComponent(injectedEntity, propertyName, Entity);

            case `store`:
            case `service`:
            default:
                return injectInClass(injectedEntity, propertyName, Entity);
        }
    };
}

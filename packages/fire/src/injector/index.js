const instancesMap = new WeakMap();
const injectProviders = [];
const registerProviders = [];

function defaultInjectProvider(instance, propertyName, Class) {
    class ClassWrapper extends Class {
        constructor(...args) {
            super(...args);

            this[propertyName] = instance;
        }
    }
    ClassWrapper.WrappedComponent = Class;
    ClassWrapper.OriginalClass = Class.OriginalClass || Class;
    ClassWrapper.displayName = Class.displayName || Class.name;
    return ClassWrapper;
}

function getClassInstance(Class) {
    let instance = instancesMap.get(Class);

    if (!instance) {
        instance = new Class();
        instancesMap.set(Class, instance);

        registerClass(Class, instance);
    }

    return instance;
}

function registerClass(Class, instance) {
    registerProviders.forEach((registerProvider) => registerProvider(Class, instance));
}

export function getPropertyNames(Class) {
    const prototype = Class.OriginalClass
        ? Class.OriginalClass.prototype
        : Class.prototype;
    return Object.getOwnPropertyNames(prototype).filter((propertyName) => propertyName !== `constructor`);
}

export function addRegisterProvider(registerProvider) {
    registerProviders.push(registerProvider);
}

export function addInjectProvider(injectProvider) {
    injectProviders.push(injectProvider);
}

export function inject(Class, propertyName) {
    return (TargetClass) => {
        const instance = getClassInstance(Class);

        const NewClass = injectProviders.reduceRight((NewClass, injectProvider) => {
            return injectProvider(instance, propertyName, NewClass);
        }, TargetClass);

        if (NewClass === TargetClass) {
            return defaultInjectProvider(instance, propertyName, TargetClass);
        }

        return NewClass;
    };
}

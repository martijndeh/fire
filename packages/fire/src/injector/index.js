const instancesMap = new WeakMap();
const injectProviders = [];

function defaultInjectProvider(instance, propertyName, Class) {
    class ClassWrapper extends Class {
        constructor() {
            super();

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
    }

    return instance;
}

export function registerInjectProvider(injectProvider) {
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

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
        console.log(`Create instance ${Class.name}`);

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
        console.log(`Inject class ${Class.name} into ${TargetClass.name}`);

        const instance = getClassInstance(Class);

        console.log(`Created class instance of ${Class.name}. Inject!`);

        const NewClass = injectProviders.reduceRight((NewClass, injectProvider) => {
            return injectProvider(instance, propertyName, NewClass);
        }, TargetClass);

        if (NewClass === TargetClass) {
            console.log(`Inject failed. Use default injector`);

            return defaultInjectProvider(instance, propertyName, TargetClass);
        }

        console.log(`And return class ${NewClass.name}`);

        return NewClass;
    };
}

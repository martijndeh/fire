import { extendObservable, observable, computed, action } from 'mobx';

const stores = {};

export default function store(Store) {
    setStore(Store.name, Store);
    return Store;
}

export function setStore(storeName, Store) {
    stores[storeName] = Store;
}

export function getStore(storeName) {
    return stores[storeName];
}

export function createStore(Store) {
    const store = new Store();

    let items = Object.getOwnPropertyNames(store).reduce((items, propertyName) => {
        // TODO: Are there any types we shouldn't set as observable e.g. injected entities?
        if (propertyName !== `constructor`) {
            items[propertyName] = store[propertyName];
        }

        return items;
    }, {});

    items = Object.getOwnPropertyNames(Store.OriginalClass.prototype).reduce((items, propertyName) => {
        const descriptor = Object.getOwnPropertyDescriptor(Store.OriginalClass.prototype, propertyName);

        if (propertyName === `constructor`) {
            return items;
        }

        const isComputed = descriptor.get && !descriptor.set && !descriptor.value;
        const isAction = typeof store[propertyName] === `function`;

        if (isComputed) {
            items[propertyName] = computed(descriptor.get);
        }
        else if (isAction) {
            // TODO: Properly set this as an action.

            // items[propertyName] = action(propertyName, store[propertyName]);
            items[propertyName] = store[propertyName];
        }
        else {
            items[propertyName] = store[propertyName];
        }

        return items;
    }, items);

    extendObservable(store, items);

    // TODO: Find all the functions. Both instance and static. Set them as action?

    return store;
}

import { extendObservable, computed } from 'mobx';
import { addRegisterProvider } from '../injector/index.js';

export default class Store {
    static history = null;

    static setHistory(history) {
        Store.history = history;
    }

    get history() {
        return Store.history;
    }
}

addRegisterProvider((Class, store) => {
    if (store instanceof Store) {
        const descriptors = new Set();
        let obj = store;
        do {
            // The last prototype in the chain is Object, but we don;t need it's own property names.
            // So we check if there is another prototype after this object, and if not, we know
            // this is Object so we're finished.
            if (!Object.getPrototypeOf(obj)) {
                break;
            }

            Object.getOwnPropertyNames(obj).forEach((propertyName) => {
                if (propertyName !== `constructor`) {
                    const descriptor = Object.getOwnPropertyDescriptor(obj, propertyName);
                    descriptors.add({
                        propertyName,
                        descriptor,
                    });
                }
            });
        } while (obj = Object.getPrototypeOf(obj));

        const items = Array.from(descriptors).reduce((items, { descriptor, propertyName }) => {
            // TODO: What if there is a descriptor.set?
            const isComputed = descriptor.get && !descriptor.set && !descriptor.value;
            const isAction = typeof store[propertyName] === `function`;

            if (isComputed) {
                // TODO: What if we have a getter and a setter?

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
        }, {});

        extendObservable(store, items);
    }
})

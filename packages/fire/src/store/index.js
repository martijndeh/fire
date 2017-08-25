import { extendObservable, computed } from 'mobx';

export default function store(Store) {
    class MagicStore extends Store {
        constructor() {
            super();

            if (!(this instanceof MagicStore)) {
                return new MagicStore();
            }

            // TODO: Move this to the decorator.
            let items = Object.getOwnPropertyNames(this).reduce((items, propertyName) => {
                // TODO: Are there any types we shouldn't set as observable e.g. injected entities?
                if (propertyName !== `constructor`) {
                    items[propertyName] = this[propertyName];
                }

                return items;
            }, {});

            const Class = Store.OriginalClass || Store;
            items = Object.getOwnPropertyNames(Class.prototype).reduce((items, propertyName) => {
                const descriptor = Object.getOwnPropertyDescriptor(Class.prototype, propertyName);

                if (propertyName === `constructor`) {
                    return items;
                }

                const isComputed = descriptor.get && !descriptor.set && !descriptor.value;
                const isAction = typeof this[propertyName] === `function`;

                if (isComputed) {
                    items[propertyName] = computed(descriptor.get);
                }
                else if (isAction) {
                    // TODO: Properly set this as an action.

                    // items[propertyName] = action(propertyName, store[propertyName]);
                    items[propertyName] = this[propertyName];
                }
                else {
                    items[propertyName] = this[propertyName];
                }

                return items;
            }, items);

            extendObservable(this, items);

            // TODO: Find all the functions. Both instance and static. Set them as action?
        }
    }
    MagicStore.OriginalClass = Store.OriginalClass || Store;
    MagicStore.displayName = Store.displayName || Store.name;
    return MagicStore;
}

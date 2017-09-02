import { isComponent } from '../component/index.js';

const callbacks = [];
const components = [];

export function getCallbacks() {
    return callbacks;
}

export function getComponents() {
    return components;
}

export default function startup(callback) {
    if (isComponent(callback)) {
        const Component = callback;

        components.push(Component);
    }
    else {
        callbacks.push(callback);
    }
}

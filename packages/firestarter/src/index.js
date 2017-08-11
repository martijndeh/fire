import component from './component/index.js';
import service from './service/index.js';
import store from './store/index.js';
import inject from './inject/index.js';
import createServer from './server/index.js';

function isClient() {
    return (typeof window !== `undefined`);
}

function isServer() {
    return !isClient();
}

export {
    component,
    service,
    store,
    inject,
    isClient,
    isServer,
    createServer,
};

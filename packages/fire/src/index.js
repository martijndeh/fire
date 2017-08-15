import component from './component/index.js';
import service from './service/index.js';
import store from './store/index.js';
import { inject, registerInjectProvider } from './injector/index.js';
import createServer from './server/index.js';
import { exposed, guarded, login } from './service/server-service.js';

function isClient() {
    return (typeof window !== `undefined`);
}

function isServer() {
    return !isClient();
}

export {
    component,
    createServer,
    exposed,
    guarded,
    login,
    service,
    store,
    inject,
    isClient,
    isServer,
    registerInjectProvider,
    setTheme,
    style,
};

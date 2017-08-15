import { Link, Route, Switch } from 'react-router-dom';
import React from 'react';
import component from './component/index.js';
import service from './service/index.js';
import store from './store/index.js';
import { inject, registerInjectProvider } from './injector/index.js';
import createServer from './server/index.js';
import { allow, deny, login } from './service/server-service.js';
import { style, setTheme } from './style/index.js';

function isClient() {
    return (typeof window !== `undefined`);
}

function isServer() {
    return !isClient();
}

export {
    allow,
    component,
    createServer,
    deny,
    Link,
    login,
    inject,
    isClient,
    isServer,
    React,
    registerInjectProvider,
    Route,
    service,
    setTheme,
    store,
    style,
    Switch,
};

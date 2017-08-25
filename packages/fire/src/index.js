import classNames from 'classnames';
import { configureWebpack, addShims } from 'fire-webpack';
import Lego from 'lego-sql';
import model from 'sql-models';
import { Link, Route, Switch } from 'react-router-dom';
import React from 'react';
import component, { observer } from './component/index.js';
import service from './service/index.js';
import store from './store/index.js';
import { inject, registerInjectProvider } from './injector/index.js';
import createServer from './server/index.js';
import { allow, deny, login } from './service/server-service.js';
import { style, setTheme } from './style/index.js';
import worker from './worker/index.js';

const sql = Lego.sql;
const transaction = Lego.transaction;
const parse = Lego.parse;
const raw = Lego.raw;

function isClient() {
    return (typeof window !== `undefined`);
}

function isServer() {
    return !isClient();
}

export {
    addShims,
    allow,
    classNames,
    component,
    configureWebpack,
    createServer,
    deny,
    inject,
    isClient,
    isServer,
    Link,
    login,
    model,
    observer,
    parse,
    raw,
    React,
    registerInjectProvider,
    Route,
    service,
    setTheme,
    sql,
    store,
    style,
    Switch,
    transaction,
    worker,
};

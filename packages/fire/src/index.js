import Log from 'fire-log';
import classNames from 'classnames';
import check from 'type-check-system';
import fetch from 'node-fetch';
import { configureWebpack, addShims } from 'fire-webpack';
import Lego from 'lego-sql';
import { Link, Route, Switch, Redirect } from 'react-router-dom';
import React from 'react';
import { Schema, Table } from 'sql-models';
import component, { observer } from './component/index.js';
import { Service, registerService } from './service/index.js';
import Store from './store/index.js';
import { inject, addInjectProvider, addRegisterProvider } from './injector/index.js';
import createServer from './server/index.js';
import { allow, deny, login } from './service/server-service.js';
import { style, setTheme } from './style/index.js';
import Worker, { startWorkers } from './worker/index.js';
import startup from './startup/index.js';

const sql = Lego.sql;
const transaction = Lego.transaction;
const parse = Lego.parse;
const raw = Lego.raw;

function isRunning() {
    return !process.env.FIRE_STAGE || process.env.FIRE_STAGE === `start`;
}

function isClient() {
    return isRunning() && typeof window !== `undefined`;
}

function isServer() {
    return isRunning() && !isClient();
}

const registerInjectProvider = (...args) => {
    // TODO: This is deprecated.

    return addInjectProvider(...args);
};

export {
    addShims,
    addInjectProvider,
    addRegisterProvider,
    allow,
    check,
    classNames,
    component,
    configureWebpack,
    createServer,
    deny,
    fetch,
    inject,
    isClient,
    isServer,
    Link,
    Log,
    login,
    Table,
    observer,
    parse,
    raw,
    React,
    Redirect,
    registerInjectProvider,
    registerService,
    Route,
    Schema,
    Service,
    setTheme,
    sql,
    startup,
    startWorkers,
    Store,
    style,
    Switch,
    transaction,
    Worker,
};

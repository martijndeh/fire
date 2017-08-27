import classNames from 'classnames';
import check from 'type-check-system';
import fetch from 'node-fetch';
import { configureWebpack, addShims } from 'fire-webpack';
import Lego from 'lego-sql';
import model from 'sql-models';
import Model from './model/index.js';
import { Link, Route, Switch } from 'react-router-dom';
import React from 'react';
import component, { observer } from './component/index.js';
import service, { Service } from './service/index.js';
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

function isRunning() {
    return !process.env.FIRE_STAGE || process.env.FIRE_STAGE === `start`;
}

function isClient() {
    return isRunning() && typeof window !== `undefined`;
}

function isServer() {
    return isRunning() && !isClient();
}

export {
    addShims,
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
    login,
    model,
    Model,
    observer,
    parse,
    raw,
    React,
    registerInjectProvider,
    Route,
    service,
    Service,
    setTheme,
    sql,
    store,
    style,
    Switch,
    transaction,
    worker,
};

# The fastest way to build your minimal viable product.
[![Build Status](https://travis-ci.org/martijndeh/fire.svg?branch=master)](https://travis-ci.org/martijndeh/fire)
[![Coverage Status](https://coveralls.io/repos/martijndeh/lego/badge.svg?branch=master&service=github)](https://coveralls.io/github/martijndeh/lego?branch=master)
[![License Badge](https://img.shields.io/github/license/martijndeh/fire.svg)](https://github.com/martijndeh/fire/blob/master/LICENSE)

[nodeonfire.org](http://nodeonfire.org/)

---
[![Node on Fire Logo](http://nodeonfire.org/images/node-on-fire-github-logo.png)](http://nodeonfire.org/)

The fastest way to build your minimal viable product. Using React, MobX, Koa and Postgres. **Under active development.**

---

```js
import React from 'react';
import {
    component,
    service,
} from 'fire';

@service
class MyService {
    loadItems() {
        return [
            `Item #1`,
            `Item #2`,
            `Item #3`,
        ];
    }
}

@inject(MyService, `myService`)
@store
class MyStore {
    items = [];

    loadItems() {
        this.items = await this.myService.loadItems();
    }
}

@inject(MyStore, `myStore`)
@component('/')
class App extends React.Component {
    componentDidMount() {
        this.props.myStore.loadItems();
    }

    render() {
        const {
            items,
        } = this.props.myStore;

        return (
            <div>
                 <h1>Hello, world!</h1>

                 {items.map((item) => <p>{item}</p>)}
             </div>
        );
    }
}
```

Node on Fire reduces boilerplate and improves developer productivity significantly. The idea is to
give you everything you need until your first 100,000 users.

## API

- `@component(path)` add the target `React.Component` to a route on `path`.
- `@service` creates a back-end service which is invokable on the client and server-side. On the client-side, the service is transparently invoked over HTTP.
- `@inject(Class, propertyName)` injects an instance of `Class` in the target. In case the target is `React.Component`, the instance is added to the `props`, otherwise it's added as a property.
- `@store` creates a basic MobX store: all properties are set as observables, getter functions as computed, and functions as actions.

## API (in development)
- `@style` adds a stylesheet to a `React.Component` a la JSS. The stylesheet is added to the `classes` on the `props` object.
- `@computed`
- `@action`
- `@observer`
- `@model` creates a model.
- `@worker` adds a worker process and allows to execute tasks over a message queue.
- `@experiment` defines an experiment and participates the user to the experiment.
- `@login`.
- `@logout`.
- `@exposed` marks a function as public meaning it's invokable. In `development` everything should be public, but in production, everything is protected by default.
- `@guarded(authFunction)` adds `authFunction` which should check the access.

## Help wanted!

Do you want to contribute? Getting started is easy and you can always reach out to [@martijndeh](https://twitter.com/martijndeh). You could work on the following bits:

- Make sure the `fire start` watches changes and refresh both the client- and server-side of things.
- Start the `@style` decorator which ideally is a wrapper around http://cssinjs.org.
- Implement server side rendering!
- Create the `@experiment` decorator which could work with https://github.com/martijndeh/musketeer.
- Create a `@worker` which runs on the server and can execute tasks in a different process other than the web. E.g. so we can send mails on another process. It should be as transparent as `@service`.
- Come up with other cool stuff. :)

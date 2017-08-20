# The fastest way to build your minimal viable product.
[![Build Status](https://travis-ci.org/martijndeh/fire.svg?branch=master)](https://travis-ci.org/martijndeh/fire)
[![Coverage Status](https://coveralls.io/repos/martijndeh/fire/badge.svg?branch=master&service=github)](https://coveralls.io/github/martijndeh/fire?branch=master)
[![License Badge](https://img.shields.io/github/license/martijndeh/fire.svg)](https://github.com/martijndeh/fire/blob/master/LICENSE)

<br/>

---
[![Node on Fire Logo](http://nodeonfire.org/images/node-on-fire-github-logo.png)](http://nodeonfire.org/)

The fastest way to build your minimal viable product. Using React, MobX, Koa and Postgres. **Under active development.**

---
[nodeonfire.org](http://nodeonfire.org/)

<br/>

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

#### `@component(path, options)`
Add the target `React.Component` to a `Route` with `path`.

Argument | Type | Description
----------|------|-------------
**path** | `String` | The path to mount the component on.
**options** | `Object` |
**options.exact=true** | `Boolean` | Sets the `Route` exact property. See [React Router](https://reacttraining.com/react-router/web/api/Route/exact-bool). Defaults to true.
**options.error** | `Number[]/Number` | Links one or more error codes to the component. Whenever a service method returns a matching error code, the client is redirect to the component.
**...options** | | The remaining options are passed to the `Route` component.

**Simple page example.** Mounts the component on `/`.
```js
@component(`/`)
class MyComponent extends React.Component {
    //
}
```

**Login page example.**
Mounts the component on `/login`. Additionally, whenever a service method returns a status code 401, the client is redirected to this component.
```js
@component(`/login`, { error: 401 })
class Login extends React.Component {
    //
}
```
#### `@service`
Creates a back-end service which is invokable on the client and server-side. On the client-side, the service is transparently invoked over HTTP.

By default, because of security concerns, no service method is accessible from the client. You have to allow or deny clients access, see `@allow` and `@deny`.

On the client, the service methods are stripped from being included in the source by `babel-plugin-transform-strip-classes`.

**Simple example.**
```js
@service
class MyService {
    @allow(() => () => true)
    test() {
        return 'Hello, world!';
    }
}

@inject(MyService, `myService`)
class MyComponent extends React.Component {
    async componentDidMount() {
        const test = await this.props.myService.test();

        // test = `Hello, world!`
    }
}
```

#### `@inject(Class, propertyName)`
Injects an instance of `Class` in the target. In case the target is `React.Component`, the instance is added to the `props`, otherwise it's added as a property of the instance. The created instance is re-used when injecting multiple times.

Argument | Type | Description
----------|------|-------------
**Class** | `Class` | The Class of the instance to inject.
**propertyName** | `String` | The name of the property the instance is injected to.

```js
class Foo {
    test() {
        return `Hello, world!`;
    }
}

@inject(Foo, `foo`)
class Bar {
    //
}

const bar = new Bar();
const test = bar.foo.test();

// test = `Hello, world!`
```

#### `@store`
Creates a basic MobX store: all properties are set as observables, getter functions as computed, and functions as actions. This is a convenience decorator. Alternatively, you can call `@action`, `@observable`, `@computed` et al are also available.

#### `@style(classes)`
Adds a JSS style to a `React.Component`.

Argument | Type | Description
----------|------|-------------
**classes** | `Object/Function` | A classes object with key-values, or a function which takes a theme object and returns classes.

**Simple example.**
```js
@style({
    button: {
        backgroundColor: `#f0f`,
    },
})
class MyComponent extends React.Component {
    render() {
        const {
            classes,
        } = this.props;

        return (
            <button className={classes.button}>Click me</button>
        );
    }
}
```

**Theme example.** You can also use a theme, see `setTheme`.
```js
setStyle({
    magenta: `#f0f`,
});

@style((theme) => ({
    button: {
        backgroundColor: theme.magenta,
    },
}))
class MyComponent extends React.Component {
    render() {
        const {
            classes,
        } = this.props;

        return (
            <button className={classes.button}>Click me, too</button>
        );
    }
}
```

#### `setTheme(theme)`
Sets the theme which is accessible in `@style`.

Argument | Type | Description
----------|------|-------------
**theme** | `Object` | A theme object with key-values.

**Example.** Set a theme and use it in `@style`.
```js
setStyle({
    magenta: `#f0f`,
});

@style((theme) => ({
    button: {
        backgroundColor: theme.magenta,
    },
}))
class MyComponent extends React.Component {
    render() {
        const {
            classes,
        } = this.props;

        return (
            <button className={classes.button}>Click me, too</button>
        );
    }
}
```

#### `configureWebpack(type, reducer)`

Extends the webpack config for the given type.

Argument | Type | Description
----------|------|-------------
**type** | `String` | Either `client` or `server`.
**reducer** | `Function` | A function which takes a config and returns a new config. You may mutate the existing config, just make sure you always return the config.

**Example**
```js
configureWebpack(`client`, (config) => {
    config.devtool = `source-map`;
    return config;
});
```

#### `addShims(type, moduleNames)`
Configures which 3rd party modules should be shimmed. If type is set to client the modules will be shimmed in the client bundle. If type is set to server the modules will be shimmed on the server side.

Some modules are only designed to work on either the client or the server side, but, in Node on Fire, all your code plus it's modules run on both the client and the server side. To ignore a module on a specific side, you can shim the module.

The following modules are shimmed in the client bundle by default:
- fsevents
- koa
- webpack
- koa-webpack
- dns

Argument | Type | Description
----------|------|-------------
**type** | `String` | The type, or side, on which to shim. Either client or server.
**moduleNames** | `String[]` | The module names to shim.

**Example**
```js
addShims(`client`, [`foo`, `bar`]);
```

#### @observer
Sets the target `React.Component` as a MobX observer. This happens already when you call `@component(path, options)` on a component.

```js
@observer
class MyComponent extends React.Component {
    //
}
```

#### `@allow(accessControlFunc)`
Adds an allow rule to the service method. The user is allowed to invoke the service method if the allow rule return true.

`accessControlFunc` is invoked with the authentication token's payload and should return true if the user is allowed to invoke the method, and should return false if the user is not allowed to invoke the method. `accessControlFunc` may also return a function which takes the methods arguments and should, again, return true if the user is allowed or false if the user is not allowed to invoke the method.

See also `@deny(accessControlFunc)`.

Argument | Type | Description
----------|------|-------------
**accessControlFunc** | `Function(payload)` | The function which is invoked.

**Example.** Logged in users with role `admin` are allowed to invoke the method.
```js
@service
class MyService {
    @allow((payload) => payload && payload.role === `admin`)
    send() {
        //
    }
}
```

**Example with auth func.** Logged in users who send `Hello, world!` as `text` are allowed.
```js
@service
class MyService {
    @allow((payload) => (text) => payload && text === `Hello, world!`)
    send(text) {
        //
    }
}
```

#### `@deny(accessControlFunc)`
Adds a deny rule to the service method. The user is **not** allowed to invoke the service method if the deny rule return true. It's possible to add multiple rules to a service method and they all must allow to allow user access. See also `@allow(accessControlFunc)`.

`accessControlFunc` is invoked with the authentication token's payload and should return true if the user is **not** allowed to invoke the method, and should return false if the user is allowed to invoke the method. `accessControlFunc` may also return a function which takes the methods arguments and should, again, return true if the user is **not** allowed or false if the user is allowed to invoke the method.

Argument | Type | Description
----------|------|-------------
**accessControlFunc** | `Function(payload)` | The function which is invoked.

**Example.** Logged in users with role `admin` are allowed to invoke the method.
```js
@service
class MyService {
    @deny((payload) => !payload || payload.role !== `admin`)
    send() {
        //
    }
}
```

**Example with auth func.** Logged in users who send `Hello, world!` as `text` are allowed.
```js
@service
class MyService {
    @allow((payload) => (text) => !payload || text !== `Hello, world!`)
    send(text) {
        //
    }
}
```

#### `@login`
Configures the target service method to be a login method.

The login method's should return the user account, or throw an error. The user account's id is stored is considered the payload, which is stored in a JSON web token, and stored in a httpOnly cookie.

#### `@logout`
Configures the target service method to be a logout method.

The logout method clears the authentication cookie.


#### `@model`
Configures the target class as a model which allows you to declare your schema. All changes to your schema are automatically written in migration files.

```js
@model
class Account {
    constructor(transaction) {
        transaction.sql `CREATE TABLE account (
            id SERIAL PRIMARY KEY,
            first_name TEXT
        )`;
    }

    static findByName(firstName) {
        return sql `SELECT * FROM account WHERE first_name = ${firstName}`;
    }
}
```

In the build stage, the first migration is created with the schema of `account`. Now, whenever you change the schema, for example, add a `NOT NULL` clause to the `first_name` column, the second migration is automatically created.

#### `Route`
#### `Switch`
#### `Link`
#### `@login`
#### `isClient`
#### `isServer`
#### `React`
#### `registerInjectProvider`

## API (in development)
- `@computed`
- `@action`
- `@observable`
- `@model` creates a model.
- `@worker` adds a worker process and allows to execute tasks over a message queue.
- `@experiment` defines an experiment and participates the user to the experiment.
- `@logout`.

## Help wanted!

Do you want to contribute? Getting started is easy and you can always reach out to [@martijndeh](https://twitter.com/martijndeh). You could work on the following bits:

- Make sure the `fire start` watches changes and refresh both the client- and server-side of things.
- Implement server side rendering!
- Create the `@experiment` decorator which could work with https://github.com/martijndeh/musketeer.
- Create a `@worker` which runs on the server and can execute tasks in a different process other than the web. E.g. so we can send mails on another process. It should be as transparent as `@service`.
- Come up with other cool stuff. :)

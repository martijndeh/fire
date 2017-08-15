# The fastest way to build your minimal viable product.
[![Build Status](https://travis-ci.org/martijndeh/fire.svg?branch=master)](https://travis-ci.org/martijndeh/fire)
[![Coverage Status](https://coveralls.io/repos/martijndeh/lego/badge.svg?branch=master&service=github)](https://coveralls.io/github/martijndeh/lego?branch=master)
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
**path** | *String* | The path to mount the component on.
**options** | *Object* |
**options.exact=true** | *Boolean* | Sets the `Route` exact property. See [React Router](https://reacttraining.com/react-router/web/api/Route/exact-bool). Defaults to true.
**options.error** | *Number[]/Number* | Links one or more error codes to the component. Whenever a service method returns a matching error code, the client is redirect to the component.
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
**Class** | *Class* | The Class of the instance to inject.
**propertyName** | *String* | The name of the property the instance is injected to.

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
**theme** | *Object* | A theme object with key-values.

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

#### `Route`
#### `Switch`
#### `Link`
#### `@exposed`
#### `@guarded`
#### `@login`
#### `isClient`
#### `isServer`
#### `React`
#### `registerInjectProvider`

## API (in development)
- `@computed`
- `@action`
- `@observer`
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

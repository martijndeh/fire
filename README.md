Node on Fire
====

An opinionated, convention-based Node web framework focused on developer productivity.

== Installation
```
npm install fire
```

== Features
- Automatic routing based on conventions.
- Sweet Model-View-Controller pattern.
- Object relational mapping based on node-orm2.
- Jade template rendering system. Can be easily replaced e.g. with Mustache.
- Compiles less files to css and serves them. Can be replaced easily with another compiler e.g. Stylus.
- Express/Connect-compatible middleware system.

== Philosophy

- DRY.
- Convention over configuration.
- Sane defaults.

== Todos

- Tests.
- Cookies and sessions.
- Body parsing.
- File uploads.

== Introduction

In your main file:
```js
var fire = require('fire');
var app = fire();
app.run();
```

In ```controllers/``` your first controller called `hello.js`:
```js

function HelloCtrl() {

}

HelloCtrl.prototype.getIndex = function() {
	return {
		hello: 'world'
	}
}

```

Node on Fire automatically builds the routes. The HTTP method e.g. GET must match the start of controller's method name. The return value of your controller's method get passed to the view.

== Views

Explain naming convention, explain setting a different view system e.g. Mustache, explain setting view in controller.

Render method and content type. A controller only supports one content type. Generally it's a good idea to implement a different controller if you need to return a different content type.

== Models

Explain naming convention, refer to node-orm2, show promise api e.g. returning a post and showing it in a view.

== Advanced Routing
- Subdirectories
- Filter

== Input

Type to do javascript stuff.

== Examples

See ```examples/hello-world``` for an example app.


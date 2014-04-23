#### Under active development. Not feature-complete yet and unstable.

[![Build Status](https://travis-ci.org/martijndeh/fire.svg?branch=master)](https://travis-ci.org/martijndeh/fire)
## Node on Fire
A productive & convention-based web framework.

### Installation
```
npm install fire
```

### Features
- Productive.
- Naming convention-based routing system.
- Persistent models and associations.
- Migration-based schema creation.
- Auto-generate migrations.
- Integrated pub-sub to workers.
- Configurable template system.
- Promise-based.

### Philosophy

Integrated and non-awkward public interface.

### Introduction

In your main file e.g. `index.js`:
```js
var fire = require('fire');
var app = fire();
app.run();
```

In ```controllers/``` your first controller called `hello.js`:
```js
function HelloController() {

}

HelloController.prototype.getIndex = function() {
	return {
		text: 'Hello, world.'
	};
}
```
In `views/hello/index.jade`:
```jade
doctype html
html(lang="en")
  head
    title Node on Fire Test
  body
    h1= text
```

Now start your first app by calling your main file e.g. `$ node index.js` and open http://127.0.0.1:3000/ in your browser.

If you want to learn more about Node on Fire, please check the wiki over at https://github.com/martijndeh/fire/wiki. You can also have a look through the different examples in the `examples/` directory.

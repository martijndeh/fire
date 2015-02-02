# Changelog

## 0.23.0

### Improvements

- Implement Controller#ready which gets called when the view is ready and attached to the DOM.

## 0.22.5

### Bug fixes

- Fixes issue where an error would throw when clicking anchor tags with empty hrefs.

## 0.22.4

### Bug fixes

- Fixes issue where promises wouldn't resolve in Ractive-based apps.

## 0.22.3

### Bug fixes

- Fixes issue where update and delete statements would escape values incorrectly with a limit clause.

## 0.22.2

### Bug fixes

- Fixes issues where some queries with ? would produce the wrong results.

## 0.22.1

### Breaking changes

- Disables less css source maps.

## 0.22.0

### Bug fixes

- Fixes issue where migrations would not get generated.

### Breaking changes

- `PropertyTypes#Has` now only accepts one argument. `hasModel` is deprecated.

### Improvements

- Middleware module extended with express-esque App#use.
- You can now define which properties may be set through the api via PropertyTypes#CanSet.

## 0.21.0

### Bug fixes

- Fixes issue where `Models#execute` would run multiple times during migrations.
- Fixes issue where sessions would expire even during activity.
- Fixes issue where `grunt release` sometimes wouldn't work.

### Breaking changes

- It's not possible anymore to query on a property with a hash method. Instead, use `ModelInstance#validateHash`.
- When a model is created, update or deleted it's considered partial and any association keys are not included.
- Removes less middleware and compiles less and jade in the build phase. This also means referring to `/templates/my-template.jade` is deprecated. Instead, you need to refer to `/templates/my-template.html`.
- Read, update and delete actions in the API now also use query params in the where clause.
- Access control methods `CanCreate`, `CanRead`, `CanUpdate` and `CanDelete` do not have a `this` anymore and use dependency injection instead.
- `PropertyTypesHas` now uses dependency injection and does not have a `this` anymore.
- Changes `AMQP_URL` to `BROKER_URL`.
- Sign out now clears the authenticator's access token in the datastore.

### Improvements

- Adds salt property to authenticator model. This should be backwards compatible.
- Implements authenticator#findMe.
- `grunt release` doesn't return an error anymore when the datastore is already up-to-date.

## 0.20.0

### Bug fixes

- Fixes issue where Node on Fire migrations are not executed. This change should create ClockTaskResult and TriggerResult models and triggerResult property to authenticator during the next migration, if they not already exist.

### Breaking changes

- Deprecates old-style Gruntfile.js declaration.

### Improvements

- Optimizes dependency injection to prepare once and execute many times.

## 0.19.0

### Bug fixes
- Fixes crash in HTTP handler when error an error occurs but it's null.
- Fixes issue where auto-fetched associations of associations (of associations, ...) would not get fetched.

### Breaking changes

- Removes requirement to use `$` in route methods.

### New features

- Replaces existing query builder system with knex.js.
- Implements a generic dependency injector module.
- Implements a express-like middleware module with dependency injection.

## 0.18.0

### Bug fixes

- Fixes issue when ModelInstance#save is called without any changes. This issue was only occuring on the front-end.
- Fixes issue when calling Model#find with model instance properties not getting properly resolved in the query.
- Fixes issue where sometimes `grunt build` wouldn't build all parts.
- Changes migration file names to [0-9]{3} to force conflicts when multiple migrations get created.
- Fixes naming issue in one-to-one associations.
- Fixes an issue where deleting many-to-many associations sometimes fails.
- Fixes issue where relationships in models were not properly set.

### Breaking changes

- Changes `stylesheets` to `styles` in `app.options`.
- Creating new model instances now automatically updates locally.

### New features

- Creates new build system which should be integrated in a project's Gruntfile.
- Implements deleting model instance in the front-end.
- Implements additional model instance methods to manage associations (create, read, update, delete).
- Implements dependency injection in Model constructors.
- Implements $ilike: case-insensitive like.

## 0.15.3

### Bug fixes

- Fixes issue where many-to-many association could return duplicate values in deep auto-fetched associations.

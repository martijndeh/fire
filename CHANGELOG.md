# Changelog

## 0.29.2

### Improvements

- Changes tests service to provider.

## 0.29.1

### Bug fixes

- Fixes unknown schemas table issue in grunt release.
- Fixes unknown view.jade issue in single-app project.
- Fixes issue where shared models would sometimes not get created in single-app projects.

## 0.29.0

### Improvements

- Fixes access control in many-to-many associations. Access control is defined on the through model.
- Moves installing uuid-ossp Postgres extension from run stage to release stage.

## 0.28.8

### Bug fixes

- Fixes duplicate process type names in Procfile.

## 0.28.7

### Bug fixes

- Fixes issue where building Procfile would sometimes not include all workers.

## 0.28.6

### Bug fixes

- Fixes issue where only one path per controller instead of multiple would work.

## 0.28.5

### Bug fixes

- Fixes issue where saving model instances sometimes failed.

## 0.28.4

### Bug fixes

- Fixes issue where grunt release would fail if there are 0 migration files.

## 0.28.3

### Bug fixes

- Implements issue where workers of different apps were not available.

## 0.28.2

### Bug fixes

- Fixes issue which sometimes prevented schemas from being created.

## 0.28.1

### Bug fixes

- Fixes issue where after a Node on Fire upgrade some migrations would throw errors.

## 0.28.0

### New features

- Re-implements many-to-many associations.

### Bug fixes

- Fixes issue where test models would be included in non-master migrations.
- Fixes issue where password property is unavailable on authenticator models in non-master apps.
- Fixes issue where reset password model would sometimes end up in migrations of non-master apps.

### Improvements

- Creates app setting `includeAPI` which sets whether the app, if it's not the master app, should include the HTTP API.
- Includes example app.

## 0.27.4

### Bug fixes

- Fixes an issue where password property is unavailable on authenticator models
- Fixes an issue where some return values in access control would cause errors.

## 0.27.3

### Bug fixes

- Fixes transforming app.directive(string, function) properly.
- Fixes loading the correct view.jade/view.html.

### Improvements

- Exposes app in build system (Gruntfile).
- Implements `public/_shared` as public folder.

## 0.27.2

### Bug fixes

- Fixes issue with upgrading the Schema model.

## 0.27.1

### Bug fixes

- Fixes issue with anonymous functions in App#run.

## 0.27.0

### Breaking changes

- Moves `_api` and `_migrations` to `.fire` folder.
- Removes SEO module (which implements PhantomJS).
- PropertyTypes#Authenticate is now also set to unique.
- Internal models are now also written to your migrations.
- Removes automatic many-to-many relations. Create two one-to-many relations to a connecting model instead.
- Dependency injection is now available in the model hooks e.g. Model#afterCreate.
- Access control is now defined via a method Model#accessControl instead of a virtual property.
- Controller's in Angular now automatic set the templateUrl of the controller based on the controller's name.
- Deprecates ignoreDisabled in favor of stages.
- Automatically generates a Procfile based on the workers, schedulers, triggers, etc.
- Changes routing of controller's to just one path in App#controller.
- Templates do not get compiled anymore in the run phase. Instead, templates get compiled during the build phase.

### Bug fixes

- Fixes issue where model's associations
- Fixes issue where datastore transaction's would sometimes fail.
- Fixes issue where sometimes model properties would collide with properties in user-land.

### Improvements

- Supports multiple apps per project (which app to run is configured through the NODE_APP environment variable).
- Implements an A/B testing module.

## 0.26.1

### Breaking changes

- When destroying an already destroyed model, `Models` will not throw an error anymore.

### Bug fixes

- Fixes an issue where sorting 1 task would sometimes fail.

## 0.26.0

### Breaking changes

- `Static` is now initialised after `Middleware`. This allows `Middleware` to intercept static files.

### Improvements

- It is now possible to remove module via `App#removeModule`.

## 0.25.0

### Breaking changes

- `Clock` now cleans up clock task result rows (all but the 25 most recent ones per task).

### Bug fixes

- Fixes setting name on model constructor functions which caused errors in Node v0.12.0.

## 0.24.3

### Bug fixes

- Fixes issue where web process would crash if message broker disconnects.

### Breaking changes

- Channel#get now returns a promise which resolves to a channel instance, instead of returning a channel directly.

## 0.24.2

### Bug fixes

- Fixes issue where `next` in middleware methods would be unavailable.

## 0.24.1

### Bug fixes

- Fixes issue where using middleware methods would throw error during the build phase.

## 0.24.0

### Improvements

- Falls back to page reloads in browsers not supporting `pushState`.

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

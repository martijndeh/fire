# Changelog

# 0.20.0

### Bug fixes
- Fixes issue where Node on Fire migrations are not executed. This change should create ClockTaskResult and TriggerResult models and triggerResult property to authenticator during the next migration, if they not already exist.

### Breaking changes

- Deprecates old-style Gruntfile.js declaration.

### Improvements

- Optimizes dependency injection to prepare once and execute many times.

# 0.19.0

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

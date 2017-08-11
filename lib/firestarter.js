'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.style = exports.observer = exports.action = exports.computed = exports.observable = undefined;

var _getOwnPropertyDescriptor = require('babel-runtime/core-js/object/get-own-property-descriptor');

var _getOwnPropertyDescriptor2 = _interopRequireDefault(_getOwnPropertyDescriptor);

var _slicedToArray2 = require('babel-runtime/helpers/slicedToArray');

var _slicedToArray3 = _interopRequireDefault(_slicedToArray2);

var _extends2 = require('babel-runtime/helpers/extends');

var _extends3 = _interopRequireDefault(_extends2);

var _defineProperty2 = require('babel-runtime/helpers/defineProperty');

var _defineProperty3 = _interopRequireDefault(_defineProperty2);

var _getPrototypeOf = require('babel-runtime/core-js/object/get-prototype-of');

var _getPrototypeOf2 = _interopRequireDefault(_getPrototypeOf);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

var _getOwnPropertyNames = require('babel-runtime/core-js/object/get-own-property-names');

var _getOwnPropertyNames2 = _interopRequireDefault(_getOwnPropertyNames);

var _from = require('babel-runtime/core-js/array/from');

var _from2 = _interopRequireDefault(_from);

var _map = require('babel-runtime/core-js/map');

var _map2 = _interopRequireDefault(_map);

exports.isServer = isServer;
exports.isClient = isClient;
exports.getComponents = getComponents;
exports.getServices = getServices;
exports.store = store;
exports.component = component;
exports.service = service;
exports.inject = inject;

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _mobx = require('mobx');

var _mobxReact = require('mobx-react');

var _reactJss = require('react-jss');

var _reactJss2 = _interopRequireDefault(_reactJss);

var _remoteService = require('./remote-service.js');

var _remoteService2 = _interopRequireDefault(_remoteService);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var style = _reactJss2.default;

exports.observable = _mobx.observable;
exports.computed = _mobx.computed;
exports.action = _mobx.action;
exports.observer = _mobxReact.observer;
exports.style = style;


var componentsMap = new _map2.default();

var servicesMap = new _map2.default();
var storesMap = new _map2.default();

var instancesMap = new _map2.default();

function isServer() {
    return typeof window === 'undefined';
}

function isClient() {
    return !isServer();
}

function getComponents() {
    return (0, _from2.default)(componentsMap.entries());
}

function getServices() {
    return (0, _from2.default)(servicesMap.entries());
}

function store(Store) {
    console.log('@store');

    // Check if this guy was set in the unknowns. Or maybe just use 1 map with all stores and
    // services.

    storesMap.set(Store.name, Store);

    // TODO: Create actions of all functions.
    // TODO: Create observables of all properties.
    // TODO: We should be able to inject, right?

    return Store;
}

function component(path) {
    console.log('@component(' + path + ')');

    return function (Component) {
        componentsMap.set(path, Component);

        console.log(Component);

        return Component;
    };
}

function service(Service) {
    console.log('@service (' + Service.name + ')');

    if (isClient()) {
        var mockService = function MockService() {};
        (0, _getOwnPropertyNames2.default)(Service).forEach(function (name) {
            mockService[name] = function () {};
        });

        servicesMap.set(Service.name, mockService);
    } else {
        servicesMap.set(Service.name, Service);
    }

    return Service;
}

function injectEntityInComponent(entityInstance, propName, Component) {
    // TODO: Call hoist statics?

    // TODO: We should check if we've already created an observer.
    // TODO: Now we're always wrapping the Component in observer, even though a non-observable might
    // be injected. We should check if the entityInstance we want to inject is actually an
    // observable.
    var ObserverComponent = (0, _mobxReact.observer)(Component);

    var WrappedComponent = function (_React$Component) {
        (0, _inherits3.default)(WrappedComponent, _React$Component);

        function WrappedComponent() {
            (0, _classCallCheck3.default)(this, WrappedComponent);
            return (0, _possibleConstructorReturn3.default)(this, (WrappedComponent.__proto__ || (0, _getPrototypeOf2.default)(WrappedComponent)).apply(this, arguments));
        }

        (0, _createClass3.default)(WrappedComponent, [{
            key: 'render',
            value: function render() {
                return _react2.default.createElement(ObserverComponent, (0, _extends3.default)({}, this.props, (0, _defineProperty3.default)({}, propName, entityInstance)));
            }
        }]);
        return WrappedComponent;
    }(_react2.default.Component);

    // FIXME: This is less than ideal. We should create an index so we can get the component and
    // it's path quickly without iterating of an array. Or can we store the path on the component
    // itself?


    var entry = (0, _from2.default)(componentsMap.entries()).find(function (entry) {
        var ExistingComponent = entry[1];
        return ExistingComponent === Component;
    });
    if (entry) {
        var _entry = (0, _slicedToArray3.default)(entry, 1),
            path = _entry[0];

        // This replaces the existing component with the newly wrapped component so the order of
        // the decorators in user land is not important.


        componentsMap.set(path, WrappedComponent);
    }

    return WrappedComponent;
}

function getEntityType(Entity) {
    var entityName = Entity.displayName || Entity.name;
    var isService = servicesMap.get(entityName);
    var isStore = storesMap.get(entityName);

    if (isService) {
        return 'Service';
    } else if (isStore) {
        return 'Store';
    }

    return 'Unknown';
}

function createServiceInstance(Service) {
    if (isClient()) {
        return new _remoteService2.default(Service);
    }

    return new Service();
}

function createStoreInstance(Store) {
    // TODO: If this is a store, create the observables and actions correctly.

    var store = new Store();

    var items = (0, _getOwnPropertyNames2.default)(store).reduce(function (items, propertyName) {
        console.log(store[propertyName]);

        // TODO: Do not set injected properties as observable.
        if (propertyName !== 'myService') {
            items[propertyName] = store[propertyName];
        }

        return items;
    }, {});

    items = (0, _getOwnPropertyNames2.default)(Store.OriginalComponent.prototype).reduce(function (items, propertyName) {
        var descriptor = (0, _getOwnPropertyDescriptor2.default)(Store.OriginalComponent.prototype, propertyName);

        if (propertyName === 'constructor') {
            return items;
        }

        var isComputed = descriptor.get && !descriptor.set && !descriptor.value;
        var isAction = typeof store[propertyName] === 'function';

        if (isComputed) {
            items[propertyName] = (0, _mobx.computed)(descriptor.get);
        } else if (isAction) {
            // TODO: Properly set this as an action.

            // items[propertyName] = action(propertyName, store[propertyName]);
            items[propertyName] = store[propertyName];
        } else {
            items[propertyName] = store[propertyName];
        }

        return items;
    }, items);

    (0, _mobx.extendObservable)(store, items);

    // TODO: Find all the functions. Both instance and static.

    return store;
}

function createEntityInstance(entityType, Entity) {
    if (entityType === 'Service') {
        return createServiceInstance(Entity);
    } else if (entityType === 'Store') {
        return createStoreInstance(Entity);
    }

    return new Entity();
}

function getEntityInstance(Entity) {
    var entityType = getEntityType(Entity);
    var instanceName = '' + (Entity.displayName || Entity.name) + entityType;

    console.log('getEntityInstance ' + instanceName);
    var instance = instancesMap.get(instanceName);

    if (!instance) {
        instance = createEntityInstance(entityType, Entity);
        instancesMap.set(instanceName, instance);
    }

    return instance;
}

function inject(InjectedEntity, propName) {
    // Find the registered entity.

    return function (Entity) {
        // If Entity is a React.Componet, this is easy. If not, we don't know what type of entity
        // this is going to be.
        var isComponent = _react2.default.Component.isPrototypeOf(Entity);
        var entityToInject = getEntityInstance(InjectedEntity);

        if (isComponent) {
            return injectEntityInComponent(entityToInject, propName, Entity);
        }

        var Wrapper = function (_Entity) {
            (0, _inherits3.default)(Wrapper, _Entity);

            function Wrapper() {
                (0, _classCallCheck3.default)(this, Wrapper);

                var _this2 = (0, _possibleConstructorReturn3.default)(this, (Wrapper.__proto__ || (0, _getPrototypeOf2.default)(Wrapper)).call(this));

                _this2[propName] = entityToInject;
                return _this2;
            }

            return Wrapper;
        }(Entity);

        Wrapper.WrappedComponent = Entity;
        Wrapper.OriginalComponent = Entity.OriginalComponent || Entity;
        Wrapper.displayName = Entity.name;

        // TODO: What if there is a collision? We should figure something out.

        if (storesMap.get(Entity.name)) {
            storesMap.set(Entity.name, Wrapper);
        } else if (servicesMap.get(Entity.name)) {
            servicesMap.set(Entity.name, Wrapper);
        } else {
            //
        }

        return Wrapper;
    };
}
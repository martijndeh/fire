import { isClient } from '..';
import { getPayload } from './jwt/index.js';
import { addRegisterProvider, getPropertyNames } from '../injector/index.js';

const services = {};

export function getServiceNames() {
    return Object.keys(services);
}

export function getService(serviceName) {
    return services[serviceName];
}

export function setService(serviceName, Service) {
    services[serviceName] = Service;
}

export function setHistory(history) {
    Service.history = history;
}

export class Service {
    static history = null;

    constructor(context, schema) {
        this.context = context;
        this.schema = schema;

        if (isClient()) {
            const serviceName = this.constructor.displayName || this.constructor.name;
            const propertyNames = getPropertyNames(this.constructor);

            const createFetch = (propertyName) => {
                async function doFetch(...args) {
                    const response = await fetch(`/_api?method=${serviceName}.${propertyName}`, {
                        credentials: `same-origin`,
                        method: `POST`,
                        body: JSON.stringify(args),
                        headers: {
                            'Content-Type': `application/json`,
                        },
                    });

                    // TODO: Check the response.ok and handle it generically? E.g. if there is no
                    // connection retry a bit? If there is a 401 or 403 re-authenticate.

                    return response;
                }
                doFetch.toSrc = function (...args) {
                    return `/_api?method=${serviceName}.${propertyName}&args=${JSON.stringify(args)}`;
                };

                return doFetch;
            }
            propertyNames.forEach((propertyName) => {
                this[propertyName] = createFetch(propertyName);
            });
        }
    }

    getPayload() {
        // TODO: This should only be available on the server.

        try {
            const token = this.context.cookies.get(`t`);

            if (token) {
                return getPayload(token);
            }
        }
        catch (e) {
            console.log(`exception in service`);
            console.log(e);
        }

        return null;
    }
}

export function registerService(Service) {
    setService(Service.displayName || Service.name, Service);
}

addRegisterProvider((Class, service) => {
    if (service instanceof Service) {
        registerService(Class);
    }
});

import { isServer } from '..';
import { getPayload } from './jwt/index.js';

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

function getPropertyNames(UserService) {
    const prototype = UserService.OriginalClass
        ? UserService.OriginalClass.prototype
        : UserService.prototype;

    return Object.getOwnPropertyNames(prototype).filter((propertyName) => propertyName !== `constructor`);
}

export class Service {
    constructor(context) {
        this.context = context;
    }

    getPayload() {
        try {
            const token = this.context.cookies.get(`t`);

            if (token) {
                return getPayload(token);
            }
        }
        catch (e) {
            console.log(e);
        }

        return null;
    }
}

export default function service(UserService) {
    if (isServer()) {
        setService(UserService.displayName || UserService.name, UserService);
        return UserService;
    }

    return class ClientService {
        constructor() {
            const serviceName = UserService.displayName || UserService.name;
            const propertyNames = getPropertyNames(UserService);

            function createFetch(propertyName) {
                return (...args) => {
                    return fetch(`/_api?method=${serviceName}.${propertyName}`, {
                        credentials: `same-origin`,
                        method: `POST`,
                        body: JSON.stringify(args),
                        headers: {
                            'Content-Type': `application/json`,
                        },
                    });
                };
            }

            propertyNames.forEach((propertyName) => {
                this[propertyName] = createFetch(propertyName);
            });
        }
    }
}

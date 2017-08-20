import { isServer } from '..';
import { getPathForErrorCode } from '../component/index.js';

const services = {};
let history = null;

export function setHistory(currentHistory) {
    history = currentHistory;
}

export function getServiceNames() {
    return Object.keys(services);
}

export function getService(serviceName) {
    return services[serviceName];
}

export function setService(serviceName, Service) {
    services[serviceName] = Service;
}

function getPropertyNames(Service) {
    const prototype = Service.OriginalComponent
        ? Service.OriginalComponent.prototype
        : Service.prototype;

    return Object.getOwnPropertyNames(prototype).filter((propertyName) => propertyName !== `constructor`);
}

export default function service(Service) {
    if (isServer()) {
        class ServerService extends Service {
            constructor(context) {
                super();

                this.context = context;
            }
        }
        ServerService.displayName = Service.displayName || Service.name;
        setService(ServerService.displayName, ServerService);
        return ServerService;
    }

    return class ClientService {
        constructor() {
            const serviceName = Service.displayName || Service.name;
            const propertyNames = getPropertyNames(Service);

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

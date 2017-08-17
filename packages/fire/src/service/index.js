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
        setService(Service.displayName || Service.name, Service);
        return Service;
    }

    return class ClientService {
        constructor() {
            const serviceName = Service.displayName || Service.name;
            const propertyNames = getPropertyNames(Service);

            function createFetch(propertyName) {
                return async (...args) => {
                    try {
                        const response = await fetch(`/_api?method=${serviceName}.${propertyName}`, {
                            method: `POST`,
                            body: JSON.stringify(args),
                            headers: {
                                'Content-Type': `application/json`,
                                'X-Token': token,
                            },
                        });
                        const json = await response.json();

                        if (response.ok) {
                            if (json) {
                                if (json.redirect) {
                                    const search = history.location.search.substring(1);
                                    const redirect = (search.split(`&`).find((key) => key.indexOf(`redirect=`) === 0) || ``).substring(9) || `/`;

                                    history.replace(redirect);
                                }
                            }

                            return json.result;
                        }
                        else {
                            if (response.status === 401 || response.status === 403) {
                                const path = getPathForErrorCode(response.status);

                                if (path) {
                                    // TODO: encodeURIComponent?
                                    history.replace(`${path}?redirect=${history.location.pathname}`);
                                }
                                else {
                                    // console.log(`Warning: could not find component for error code ${response.status}`);
                                }
                            }

                            throw new Error(json);
                        }
                    }
                    catch (e) {
                        //
                    }

                    return [];
                }
            }

            propertyNames.forEach((propertyName) => {
                this[propertyName] = createFetch(propertyName);
            });
        }
    }
}

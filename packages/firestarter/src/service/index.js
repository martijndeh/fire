import { isClient } from '..';
import ClientService from './client-service.js';

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

export default function service(Service) {
    setService(Service.name, Service);
    return Service;
}

export function createService(Service) {
    if (isClient()) {
        return new ClientService(Service);
    }

    // TODO: Should we pass anything here?
    return new Service();
}

function getPropertyNames(Service) {
    const prototype = Service.OriginalComponent
        ? Service.OriginalComponent.prototype
        : Service.prototype;

    return Object.getOwnPropertyNames(prototype).filter((propertyName) => propertyName !== `constructor`);
}
export default class ClientService {
    constructor(Service) {
        const serviceName = Service.displayName || Service.name;
        const propertyNames = getPropertyNames(Service);

        console.log(`Create service ${serviceName}`);
        console.log(propertyNames);

        function createFetch(propertyName) {
            return async (...args) => {
                console.log(`Call ${propertyName}`);

                const response = await fetch(`/_api?method=${serviceName}.${propertyName}`, {
                    method: `POST`,
                    body: JSON.stringify(args),
                    headers: {
                        'Content-Type': `application/json`,
                    },
                });
                const json = await response.json();

                if (response.ok) {
                    return json;
                }
                else {
                    throw new Error(json);
                }
            }
        }

        propertyNames.forEach((propertyName) => {
            this[propertyName] = createFetch(propertyName);
        });
    }
}

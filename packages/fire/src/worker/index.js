const workers = [];

export function getWorkers() {
    return workers;
}

function getPropertyNames(Worker) {
    const prototype = Worker.OriginalComponent
        ? Worker.OriginalComponent.prototype
        : Worker.prototype;
    return Object.getOwnPropertyNames(prototype).filter((propertyName) => propertyName !== `constructor`);
}

export default function worker(queueUrl) {
    return (Worker) => {
        class WorkerWrapper {
            worker = null;
            queue = [];

            constructor() {
                // TODO: This should be here, as we shouldn't call this directly. Instead, we probably
                // want a Procfile?
                this.worker = new Worker();

                const propertyNames = getPropertyNames(Worker);

                propertyNames.forEach((propertyName) => {
                    this[propertyName] = function (...args) {
                        // TODO: Post this over rabbitmq or something. Then we worker simply listens for messages.
                        this.worker[propertyName](...args);
                    };
                });
            }
        }

        workers.push(Worker);
        return WorkerWrapper;
    };
}

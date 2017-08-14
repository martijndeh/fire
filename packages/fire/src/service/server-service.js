import { getPayload, createToken } from './jwt/index.js';
import { isClient } from '..';

const loginsSymbol = Symbol();
const guardsSymbol = Symbol();
const exposesSymbol = Symbol();

const noop = () => {};

export function guarded(guardFunc) {
    if (isClient()) {
        return noop;
    }

    return function (target, key) {
        if (!target[guardsSymbol]) {
            target[guardsSymbol] = {};
        }

        if (target[guardsSymbol][key]) {
            throw new Error(`Cannot set @guarded multiple times.`);
        }

        target[guardsSymbol][key] = guardFunc;
    };
}

export function exposed(target, key) {
    if (isClient()) {
        return noop;
    }

    if (target[guardsSymbol] && target[guardsSymbol][key]) {
        throw new Error(`@exposed(): Cannot set already guarded method as exposed.`);
    }

    if (!target[exposesSymbol]) {
        target[exposesSymbol] = {};
    }

    target[exposesSymbol][key] = true;
}

const defaultTransformFunc = (result) => {
    if (result && result.id) {
        return {
            id: result.id,
        };
    }

    throw new Error(`@login(): `);
};

export function login(target, key) {
    if (isClient()) {
        return noop;
    }

    if (!target[loginsSymbol]) {
        target[loginsSymbol] = {};
    }

    // TODO: It should be possible to pass your own transform func.
    target[loginsSymbol][key] = defaultTransformFunc;
}

export default async function callServerService(Service, methodName, context) {
    console.log(`callServerService ${methodName}`);

    const service = new Service(context);

    const guardFunc = service[guardsSymbol] && service[guardsSymbol][methodName];
    const loginFunc = service[loginsSymbol] && service[loginsSymbol][methodName];

    console.log(`guardFunc = ${!!guardFunc}`);
    console.log(`loginFunc = ${!!loginFunc}`);

    if (guardFunc) {
        console.log(`In guardFunc flow`);

        try {
            const token = context.headers[`x-token`];
            const payload = await getPayload(token);

            console.log(`Payload is`);
            console.log(payload);

            const authFunc = await guardFunc(payload);

            console.log(`Doing auth func bit`);

            const isAllowed = await authFunc(...context.request.body);

            console.log(`Is allowed: ${isAllowed}`);

            if (isAllowed) {
                // Continue
            }
            else {
                // TODO: If check if this is a 403 or 401.
                context.throw(403);
                return;
            }
        }
        catch (e) {
            context.throw(401);
            return;
        }
    }
    else if (service[exposesSymbol] && service[exposesSymbol][methodName] || loginFunc) {
        // Exposed!
        // When set as login the method is automatically considered exposed.
    }
    else {
        console.log(`404: no guard, not exposed`);

        context.throw(404);
        return;
    }

    // TODO: Check if this is a logout.

    try {
        const args = context.request.body;
        const json = service[methodName](...args);

        const body = {
            response: json,
        };

        if (loginFunc && json) {
            console.log(`This is a login call. Create the payload from the json.`);

            const payload = loginFunc(json);

            console.log(payload);

            // TODO: Also add the ip and user agent to the payload.

            const token = await createToken(payload);

            console.log(`Create the token = ${token}`);

            // TODO: Check if this is a temporary token or not e.g. set on the session.
            body.auth = {
                token,
            };

            // TODO: Set the redirect path.
            body.redirect = true;
        }

        context.type = `json`;
        context.body = JSON.stringify(body);
    }
    catch (e) {
        // TODO: Error!
        context.throw(501);
    }
}

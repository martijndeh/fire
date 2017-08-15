import { getPayload, createToken } from './jwt/index.js';

const ACCESS_CONTROL_ALLOW = `allow`;
const ACCESS_CONTROL_DENY = `deny`;

const loginsSymbol = Symbol();
const accessControlSymbol = Symbol();

function setAccessControl(target, key, type, accessControlFunc) {
    if (!target[accessControlSymbol]) {
        target[accessControlSymbol] = {};
    }

    if (target[accessControlSymbol][key]) {
        throw new Error(`Cannot set access control multiple times.`);
    }

    target[accessControlSymbol][key] = {
        accessControlFunc,
        type,
    };
}

export function allow(accessControlFunc) {
    return function (target, key) {
        setAccessControl(target, key, ACCESS_CONTROL_ALLOW, accessControlFunc);
    };
}

export function deny(accessControlFunc) {
    return function (target, key) {
        setAccessControl(target, key, ACCESS_CONTROL_DENY, accessControlFunc);
    };
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
    if (!target[loginsSymbol]) {
        target[loginsSymbol] = {};
    }

    // TODO: It should be possible to pass your own transform func.
    target[loginsSymbol][key] = defaultTransformFunc;
}

async function getPayloadFromContext(context) {
    try {
        const token = context.headers[`x-token`];
        return getPayload(token);
    }
    catch (e) {
        return null;
    }
}

export async function isAllowed(service, methodName, context) {
    const accessControl = service[accessControlSymbol] && service[accessControlSymbol][methodName];
    const loginFunc = service[loginsSymbol] && service[loginsSymbol][methodName];

    if (accessControl) {
        try {
            const {
                accessControlFunc,
                type,
            } = accessControl;

            const payload = await getPayloadFromContext(context);
            const authFunc = await accessControlFunc(payload);
            const result = await authFunc(...context.request.body);

            // TODO: We should set a 401 or 403 accordingly.

            return (result === true && type === ACCESS_CONTROL_ALLOW || result === false && type === ACCESS_CONTROL_DENY);
        }
        catch (e) {
            context.throw(401);
        }
    }
    else if (loginFunc) {
        // If a loginFunc is set, this is automatically allowed.
        return true;
    }

    return false;
}

export default async function callServerService(Service, methodName, context) {
    const service = new Service(context);

    const allowed = await isAllowed(service, methodName, context);
    if (!allowed) {
        context.throw(401);
        return;
    }

    // TODO: Check if this is a logout.

    try {
        const args = context.request.body;
        const json = service[methodName](...args);

        const body = {
            response: json,
        };

        const loginFunc = service[loginsSymbol] && service[loginsSymbol][methodName];
        if (loginFunc && json) {
            const payload = loginFunc(json);

            // TODO: Also add the ip and user agent to the payload.

            const token = await createToken(payload);

            // TODO: Check if this is a temporary token or not e.g. set on the session.
            body.auth = {
                token,
            };

            // TODO: Set the redirect path?
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

import { getPayload, createToken } from './jwt/index.js';

const ACCESS_CONTROL_ALLOW = `allow`;
const ACCESS_CONTROL_DENY = `deny`;

// TODO: change this to a generic "after" middleware.
const handlersSymbol = Symbol();
const accessControlSymbol = Symbol();

function addAccessControl(target, key, type, accessControlFunc) {
    if (!target[accessControlSymbol]) {
        target[accessControlSymbol] = {};
    }

    if (!target[accessControlSymbol][key]) {
        target[accessControlSymbol][key] = [];
    }

    target[accessControlSymbol][key].push({
        accessControlFunc,
        type,
    });
}

export function allow(accessControlFunc) {
    return function (target, key) {
        addAccessControl(target, key, ACCESS_CONTROL_ALLOW, accessControlFunc);
    };
}

export function deny(accessControlFunc) {
    return function (target, key) {
        addAccessControl(target, key, ACCESS_CONTROL_DENY, accessControlFunc);
    };
}

export function login(target, key) {
    if (!target[handlersSymbol]) {
        target[handlersSymbol] = {};
    }

    if (!target[handlersSymbol][key]) {
        target[handlersSymbol][key] = [];
    }

    target[handlersSymbol][key].push({
        type: `login`,
    });

    // Allow the user to invoke this method.
    addAccessControl(target, key, ACCESS_CONTROL_ALLOW, () => () => true);
}

export function logout(target, key) {
    if (!target[handlersSymbol]) {
        target[handlersSymbol] = {};
    }

    if (!target[handlersSymbol][key]) {
        target[handlersSymbol][key] = [];
    }

    target[handlersSymbol][key].push({
        type: `logout`,
    });

    // Allow logged in users to invoke this method.
    addAccessControl(target, key, ACCESS_CONTROL_ALLOW, (payload) => Boolean(payload));
}

async function getPayloadFromContext(context) {
    try {
        const token = context.cookies.get(`t`);

        if (token) {
            return getPayload(token);
        }
    }
    catch (e) {
        //
    }

    return null;
}

export async function isAllowed(service, methodName, context) {
    const accessControls = service[accessControlSymbol] && service[accessControlSymbol][methodName];

    if (accessControls && accessControls.length > 0) {
        try {
            const results = await Promise.all(accessControls.map(async (accessControl) => {
                const {
                    accessControlFunc,
                    type,
                } = accessControl;

                const payload = await getPayloadFromContext(context);
                const authFunc = await accessControlFunc(payload);

                const result = authFunc === true || authFunc && await authFunc(...context.request.body);

                return (result === true && type === ACCESS_CONTROL_ALLOW || result === false && type === ACCESS_CONTROL_DENY);
            }));

            return results.every((result) => result === true);
        }
        catch (e) {
            console.log(`exception in not allowed`);
            console.log(e);

            context.throw(401);
        }
    }

    return false;
}

export default async function callServerService(Service, methodName, context, schema) {
    const service = new Service(context, schema);
    const allowed = await isAllowed(service, methodName, context);
    if (!allowed) {
        context.throw(401);
        return;
    }

    // TODO: Check if this is a logout.

    try {
        const args = context.method === `POST`
            ? context.request.body
            : JSON.parse(context.request.query.args);

        const body = await Promise.resolve(service[methodName](...args));
        const handlers = {
            login: async (body) => {
                // TODO: It should be possible to pass a
                const payload = body && { id: body.id };

                // TODO: Also add the ip and user agent to the payload.

                const token = await createToken(payload);
                context.cookies.set(`t`, token, {
                    httpOnly: true,
                });
            },

            logout: async () => {
                context.cookies.set(`t`);
            },
        };

        const methodHandlers = service[handlersSymbol] && service[handlersSymbol][methodName];
        if (methodHandlers && methodHandlers.length > 0) {
            await Promise.all(methodHandlers.map((methodHandler) => {
                const handler = handlers[methodHandler.type];

                return handler(body);
            }));
        }

        // TODO: Check if we did a redirect?

        if (typeof body !== `undefined`) {
            context.type = `json`;
            context.body = JSON.stringify(body);
        }
        else {
            // If the body is undefined, we assume the user handled the context directly.
        }
    }
    catch (e) {
        console.log(`error?!`);
        console.log(e);

        // TODO: Error!
        context.throw(501);
    }
}

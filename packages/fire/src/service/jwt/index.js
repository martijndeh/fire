import jwt from 'jsonwebtoken';

// TODO: Use a public key with a password stored in the env. Check
// https://github.com/auth0/node-jsonwebtoken/issues/139 on the exact options to use.
const secret = `test`;
const algorithm = `HS512`;

function verify(token, options) {
    return new Promise((resolve, reject) => {
        jwt.verify(token, secret, options, (error, decoded) => {
            if (error) {
                reject(error);
            }
            else {
                resolve(decoded);
            }
        });
    });
}

function sign(payload, options) {
    return new Promise((resolve, reject) => {
        jwt.sign(payload, secret, options, (error, token) => {
            if (error) {
                reject(error);
            }
            else {
                resolve(token);
            }
        });
    })
}

export async function getPayload(token) {
    // TODO: Somewhere, we should link the token to an ip and user agent.

    const decoded = await verify(token, {
        // We specify which algrithms to allow explicitly.
        algorithms: [algorithm],
        // Just to be sure, we set a maxAge of 14 days.
        maxAge: `14d`,
    });

    return decoded;
}

export async function createToken(payload) {
    const token = await sign(payload, {
        algorithm,
    });

    return token;
}

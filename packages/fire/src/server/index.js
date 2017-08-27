import Koa from 'koa';
import { createClientCompiler, addShims } from 'fire-webpack';
import webpackMiddleware from 'koa-webpack';
import bodyParser from 'koa-bodyparser';
import { getServiceNames, getService } from '../service/index.js';
import callServerService from '../service/server-service.js';

export {
    addShims,
};

export default async function createServer(entry) {
    const app = new Koa();
    const serviceNames = getServiceNames();
    const compiler = createClientCompiler(entry, serviceNames);

    app.use(bodyParser());
    app.use(async (context, next) => {
        if (context.path === `/_api` && (context.method === `POST` || context.method === `GET`)) {
            try {
                const [
                    serviceName,
                    methodName,
                ] = context.request.query.method.split(`.`);

                // TODO: If context.request.body is not an array, exit.

                // TODO: There should be some sort of check to see if executing this service method is
                // allowed.
                const Service = getService(serviceName);

                await callServerService(Service, methodName, context);
            }
            catch (e) {
                console.log(e);

                context.type = `json`;
                context.body = JSON.stringify({ error: true });
                context.status = e.status || 500;
            }
        }
        else {
            await next();
        }
    });
    app.use(webpackMiddleware({
		compiler,
        dev: {
            // noInfo: true,
            stats: {
                colors: false,
            },
            // quiet: true,
        },
        hot: {
            noInfo: true,
            quiet: true,
        },
	}));
    app.use(async (context, next) => {
        await next();

        // TODO: Server-render everything? Including the css!
        // TODO: We should use jsx and renderToString?
        context.type = `html`;
        context.body = `<!doctype html>
        <html>
        <head>
          <title></title>
        </head>
        <body id="root">
        </body>
        <script src="/client.js"></script>
        </html>`;
    });
	app.listen(3000);
}

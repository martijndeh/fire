import Koa from 'koa';
import { createClientCompiler, addShims } from 'fire-webpack';
import webpackMiddleware from 'koa-webpack';
import bodyParser from 'koa-bodyparser';
import { Schema } from 'sql-models';
import { getServiceNames, getService } from '../service/index.js';
import callServerService from '../service/server-service.js';

export {
    addShims,
};

export default async function createServer() {
    const app = new Koa();
    const serviceNames = getServiceNames();
    const compiler = createClientCompiler(serviceNames);

    Schema.autoLoadTables();
    const schema = new Schema();

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

                if (!Service) {
                    console.log(`Could not find service with name ${serviceName}`);
                }
                else {
                    await callServerService(Service, methodName, context, schema);
                }
            }
            catch (e) {
                console.log(`exception in server api`);
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
            noInfo: true,
            stats: false,
            quiet: true,
            log: false,
        },
        hot: {
            noInfo: true,
            quiet: true,
            stats: false,
            log: false,
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
        <body>
            <div id="root"></div>
        </body>
        <script src="/client.js"></script>
        </html>`;
    });
	app.listen(3000);
}

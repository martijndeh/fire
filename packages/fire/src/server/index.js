import Koa from 'koa';
import { createClientCompiler } from 'fire-webpack';
import webpackMiddleware from 'koa-webpack';
import bodyParser from 'koa-bodyparser';
import { getServiceNames, getService } from '../service/index.js';
import callServerService from '../service/server-service.js';

export default function createServer(entry) {
    const app = new Koa();
    const serviceNames = getServiceNames();
    const compiler = createClientCompiler(entry, serviceNames);

    app.use(bodyParser());
    app.use(async (context, next) => {
        if (context.path === `/_api`) {
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
          <script src="/client.js"></script>
        </body>
        </html>`;
    });
	app.listen(3000);
}

import webpack from 'webpack';
import path from 'path';

export default function createClientCompiler(entry, serviceNames) {
    const shim = path.join(__dirname, `shim.js`);
    return webpack({
        stats: `none`,
        // TODO: source-map exposes the server functions. If NODE_ENV=development only set source-map?
        devtool: `source-map`,
        entry: {
            client: [
                `babel-polyfill`,
                `webpack-hot-middleware/client`,
                `isomorphic-fetch`,
                entry,
                // TODO: Or can we do fire/client here as well?
                `fire/lib/client/index.js`,
            ],
        },
        module: {
            loaders: [{
                test: /.js$/,
                exclude: /node_modules/,
                loader: `babel-loader`,
                // loader: path.join(__dirname, `..`, `node_modules`, `babel-loader`),
                options: {
                    presets: [
                        `flow`,
                        [`env`, {
                            exclude: [
                                `transform-es2015-classes`,
                            ],
                        }],
                        `react`,
                        `stage-3`,
                        `stage-2`,
                    ],
                    plugins: [
                        [path.join(__dirname, `..`, `..`, `babel-plugin-transform-strip-classes`), {
                            classes: serviceNames,
                        }],
                        `transform-decorators-legacy`,
                        `transform-runtime`,
                    ],
                },
            }],
        },
        output: {
            publicPath: `/`,
            path: `/`,
            filename: `[name].js`,
        },
        plugins: [
            new webpack.DefinePlugin({
                // NODE_ENV: JSON.stringify(`production`),
            }),
            new webpack.HotModuleReplacementPlugin(),
            new webpack.NoEmitOnErrorsPlugin(),
        ],
        target: `web`,
        node: {
            console: false,
            global: true,
            process: true,
            __filename: `mock`,
            __dirname: `mock`,
            Buffer: true,
            setImmediate: true,
            fs: `empty`,
            tls: `empty`,
            child_process: `empty`,
            net: `empty`,
            crypto: `empty`,
            path: `empty`,
        },
        resolveLoader: {
            modules: [
                path.join(__dirname, `..`, `node_modules`),
                path.join(process.cwd(), `node_modules`),
                `node_modules`,
            ],
        },
        resolve: {
            modules: [
                path.join(__dirname, `..`, `node_modules`),
                path.join(process.cwd(), `node_modules`),
                `node_modules`,
            ],
            alias: {
                fsevents: shim,
                koa: shim,
                webpack: shim,
                'koa-webpack': shim,
                dns: shim,
            },
        },
    });
}

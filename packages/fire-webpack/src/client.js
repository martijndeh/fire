import webpack from 'webpack';
import path from 'path';

import babelPluginTransformStripClasses from 'babel-plugin-transform-strip-classes';
import babelPluginTransformDecoratorsLegacy from 'babel-plugin-transform-decorators-legacy';
import babelPluginTransformRuntime from 'babel-plugin-transform-runtime';

import babelPresetFlow from 'babel-preset-flow';
import babelPresetReact from 'babel-preset-react';
import babelPresetEnv from 'babel-preset-env';
import babelPresetStage3 from 'babel-preset-stage-3';
import babelPresetStage2 from 'babel-preset-stage-2';

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
                        babelPresetFlow,
                        [babelPresetEnv, {
                            exclude: [
                                `transform-es2015-classes`,
                            ],
                        }],
                        babelPresetReact,
                        babelPresetStage3,
                        babelPresetStage2,
                    ],
                    plugins: [
                        [babelPluginTransformStripClasses, {
                            classes: serviceNames,
                        }],
                        babelPluginTransformDecoratorsLegacy,
                        babelPluginTransformRuntime,
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
        // TODO: Do we still need these as we import plugins directly now?
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

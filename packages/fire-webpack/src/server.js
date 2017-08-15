import webpack from 'webpack';
import path from 'path';
import nodeExternals from 'webpack-node-externals';

import babelPluginTransformDecoratorsLegacy from 'babel-plugin-transform-decorators-legacy';
import babelPluginTransformRuntime from 'babel-plugin-transform-runtime';

import babelPresetFlow from 'babel-preset-flow';
import babelPresetReact from 'babel-preset-react';
import babelPresetEnv from 'babel-preset-env';
import babelPresetStage3 from 'babel-preset-stage-3';
import babelPresetStage2 from 'babel-preset-stage-2';

export default function createServerBundle(entry) {
    return new Promise((resolve, reject) => {
        webpack({
            entry: {
                server: [
                    `babel-polyfill`,
                    `isomorphic-fetch`,
                    entry,
                ],
            },
            module: {
                rules: [{
                    test: /.js$/,
                    exclude: /node_modules/,
                    use: {
                        loader: `babel-loader`,
                        options: {
                            presets: [
                                babelPresetFlow,
                                babelPresetReact,
                                babelPresetEnv,
                                babelPresetStage3,
                                babelPresetStage2,
                            ],
                            plugins: [
                                babelPluginTransformDecoratorsLegacy,
                                babelPluginTransformRuntime,
                            ],
                        },
                    },
                }],
            },
            target: `node`,
            output: {
                publicPath: `/`,
                path: path.join(process.cwd(), `.build`),
                filename: `[name].js`,
            },
            externals: [nodeExternals()],
            plugins: [
                new webpack.NoEmitOnErrorsPlugin(),
                new webpack.DefinePlugin({
                    NODE_ENV: process.env.NODE_ENV,
                }),
            ],
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
            },
        }, (error, stats) => {
            if (error) {
                reject(error);
            }
            else {
                resolve(stats);
            }
        });
    });
}

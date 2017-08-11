import webpack from 'webpack';
import path from 'path';
import nodeExternals from 'webpack-node-externals';

export default function createServerBundle(entry) {
    return new Promise((resolve, reject) => {
        webpack({
            entry: {
                server: [
                    `isomorphic-fetch`,
                    `babel-polyfill`,
                    entry,
                ],
            },
            module: {
                loaders: [{
                    test: /.js$/,
                    exclude: /node_modules/,
                    loader: `babel-loader`,
                    options: {
                        presets: [
                            `flow`,
                            `react`,
                            `env`,
                            `stage-3`,
                            `stage-2`,
                        ],
                        plugins: [
                            `transform-decorators-legacy`,
                            `transform-runtime`,
                        ],
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

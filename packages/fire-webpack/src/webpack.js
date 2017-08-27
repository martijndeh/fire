import webpack from 'webpack';

export default function fireWebpack(config) {
    return new Promise((resolve, reject) => {
        webpack(config, (error, stats) => {
            if (error) {
                console.log(error);

                reject(error);
            }
            else {
                resolve(stats);
            }
        });
    });
}

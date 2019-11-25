// @noflow

/**
 * The configuration for babel transpilation.
 *
 * Here we ensure that babel retranspiles files if the node version or the
 * node environment are different.
 */

/**
 * This file will not get transpiled, so we have to be cautious in the syntax
 * we use.
 */
// eslint-disable-next-line import/no-commonjs
module.exports = function(api) {
    /**
     * Determine the major version of NodeJS that is executing.
     * The version is of the form v8.16.2, for example.
     */
    const nodeMajorVersion = process.version.split(".")[0].replace("v", "");
    // eslint-disable-next-line no-console
    console.log(`Transpiling for NodeJS ${nodeMajorVersion}`);

    /**
     * Cache based on the major node version and the environment.
     */
    api.cache.using(() => `${nodeMajorVersion}:${process.env.NODE_ENV}`);

    /**
     * Some common options.
     */
    const options = {
        comments: false,
        sourceMaps: true,
        retainLines: true,
    };

    /**
     * We're going to compile based on the node version executing.
     */
    const presets = [
        [
            "@babel/preset-env",
            {
                targets: {
                    node: nodeMajorVersion,
                },
            },
        ],
        "@babel/preset-flow",
    ];

    /**
     * Plugins to use.
     */
    const plugins = ["@babel/plugin-proposal-class-properties"];

    const config = {
        presets,
        plugins,
        ...options,
    };
    return config;
};

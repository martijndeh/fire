export default function (context) {
    const classes = new Set();
    const pluginName = `strip-classes`;
    return {
        name: pluginName,
        manipulateOptions(pluginOptions) {
            const plugins = pluginOptions.plugins.filter(([plugin]) => plugin && plugin.key === pluginName);
            const [
                ,
                options,
            ] = plugins[0];

            if (options && options.classes && Array.isArray(options.classes)) {
                options.classes.forEach((className) => {
                    classes.add(className);
                });
            }
        },

        visitor: {
            ClassDeclaration(path) {
                if (path.node.seen) {
                    return;
                }

                const className = path.node.id.name;
                if (classes.has(className)) {
                    const methodNames = [];

                    path.traverse({
                        ClassMethod(classMethodPath) {
                            if (!classMethodPath.node.static) {
                                methodNames.push(classMethodPath.node.key.name);
                            }
                        },

                        ClassProperty(classPropertyPath) {
                            if (context.types.isFunction(classPropertyPath.node.value) && !classPropertyPath.node.value.static) {
                                methodNames.push(classPropertyPath.node.key.name);
                            }
                        },
                    });

                    const node = context.types.classDeclaration(
                        path.node.id,
                        path.node.superClass,
                        context.types.classBody(methodNames.map((methodName) => context.types.classMethod(
                            `method`,
                            context.types.identifier(methodName),
                            [],
                            context.types.blockStatement([]),
                        ))),
                        path.node.decorators || [],
                    );
                    node.seen = true;
                    path.replaceWith(node);
                }
            },
        },
    };
}

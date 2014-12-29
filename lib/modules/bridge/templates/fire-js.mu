App.prototype.loadController = function(path) {
    var self = this;

    function loadController(controllerName, templateUrl) {
        $.get(templateUrl, function(templateHtml) {
            var controllerMap = app.controllersMap[controllerName];
            var data = {};
            var ractive = new Ractive({
                el: 'view',
                template: templateHtml,
                data: data,
                error: function(error) {
                    console.log('An error occured.');
                    console.log(error);
                }
            });

            var controller = {
                ractive: null,
                location: function(path) {
                    return app.location(path);
                },
                wrapCallback: function(callback) {
                    return function() {
                        var args = new Array(arguments.length);
                        for(var i = 0; i < args.length; ++i) {
                            args[i] = arguments[i];
                        }

                        var result = callback.apply(this, args);

                        if(Q.isPromise(result)) {
                            result.catch(function(error) {
                                if(controller.error) {
                                    controller.error(error);
                                }
                            });
                        }
                        else {
                            //
                        }
                    };
                },
                on: function(event, callback) {
                    return ractive.on(event, this.wrapCallback(callback));
                },
                observe: function(keypath, callback) {
                    return ractive.observe(keypath, this.wrapCallback(callback), {
                        init: false
                    });
                }
            };

            var ignoreKeys = Object.keys(controller);

            self.execute(controllerMap.constructor, controller, controllerMap.params);

            Object.keys(controller).forEach(function(key) {
                if(ignoreKeys.indexOf(key) === -1) {
                    var promise = controller[key];

                    Object.defineProperty(controller, key, {
                        set: function(value) {
                            data[key] = value;
                            ractive.set(key, value);

                            if(typeof value == 'function') {
                                ractive[key] = value;
                            }
                        },

                        get: function() {
                            return data[key];
                        }
                    });

                    if(Q.isPromise(promise)) {
                        promise
                            .then(function(value) {
                                controller[key] = value;
                                //ractive.data[key] = value;
                                //ractive[key] = value;
                                //ractive.set(key, value);
                            })
                            .catch(function(error) {
                                controller[key] = null;

                                if(controller.error) {
                                    controller.error(error);
                                }
                            });
                    }
                    else {
                        if(typeof promise == 'function') {
                            controller[key] = controller.wrapCallback(promise);
                        }
                        else {
                            data[key] = promise;
                            ractive.set(key, promise);
                        }
                    }


                }
            });
        });
    }

    {{#controllers}}{{#routes}}{{#isView}}
    if(new RegExp('^{{pathRegex}}$', 'i').test(path)) {
        loadController('{{name}}', '{{templatePath}}');
        return;
    }
    {{/isView}}{{/routes}}{{/controllers}}

    // TODO: What if we found no route?
};

var page = require('webpage').create();
var system = require('system');

if(system.args.length === 1) {
    phantom.exit();
}

var url = system.args[1];

page.open(url, function() {
    var html = page.evaluate(function() {
        return document.all[0].outerHTML;
    });
    console.log(html);
    phantom.exit();
});

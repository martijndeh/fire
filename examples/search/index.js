'use strict';

/**
 * Let's initialize our app.
 */
var fire = require('fire');
var app = fire.app('search', {
	modules: ['angular-route'],

	// We pass the NODE_ENV to the config so it's available in the jade templates.
	NODE_ENV: process.env.NODE_ENV
});

var fs = require('fs');

/**
 * Let's load all the cities in the datastore.
 *
 * We do this in the run stage. This is not an elegant solution. A more elegant solution would be to create a one-off task.
 */
app.configure(function(CityModel, $q) {
	var data = fs.readFileSync('cities.txt', {encoding: 'utf8'});
	var cityNames = data.split('\n');
	var result = $q.when(true);

	cityNames.forEach(function(cityName) {
		result = result.then(function() {
			return CityModel.findOrCreate({name: cityName}, {});
		});
	});

	return result;
});

/**
 * Our City model. Must contain a name and that's it.
 */
function City() {
	this.name = [this.String, this.Required];
}
app.model(City);

/**
 * We define the search config so this model is searchable. This let's Node on Fire know to create a City#search method.
 */
City.prototype.searchConfig = function() {
	return {
		properties: ['name']
	};
};

/**
 * And our client-side controller.
 *
 * The view which belongs to this controller is located at `templates/start.jade`.
 */
app.controller('/', function StartController($scope, CityModel) {
	$scope.cities = [];

	$scope.searchCities = function(query) {
		return CityModel.search(query, {}, {limit: 20})
			.then(function(cities) {
				$scope.cities = cities;

				if(!cities.length) {
					$scope.errorMessage = 'Could not find cities. You could try `York`.';
				}
			});
	};
});

fire.start();

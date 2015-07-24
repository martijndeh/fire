/* global describe, beforeEach, afterEach, before, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');

describe('models search', function() {
	beforeEach(helper.beforeEach());
	afterEach(helper.afterEach());

	before(function() {
		helper.setup = function(app) {
			function Recipe() {
				this.title = [this.String, this.Required];
				this.description = [this.String, this.Required];
			}
			app.model(Recipe);

			Recipe.prototype.searchConfig = function() {
				return {
					properties: ['title', 'description']
				};
			};
		};

		helper.createModels = function() {
			return helper.app.models.Recipe.create([{
				title: 'Crock-Pot Chicken With Black Beans & Cream Cheese',
				description: 'Take 4-5 frozen, yes, frozen, boneless chicken breasts put into crock pot.\n\nAdd 1 can of black beans, drained, 1 jar of salsa, 1 can of corn drained.\n\nKeep in crock pot on high for about 4-5 hours or until chicken is cooked.\n\nAdd 1 package of cream cheese (just throw it on top!) and let sit for about 1/2 hour.\n\nAll done and enjoy!\n\nIngredients:\n\n4 -5 boneless chicken breasts\n1 (15 1/2 ounce) can black beans\n1 (15 ounce) can corn\n1 (15 ounce) jar salsa, any kind\n1 (8 ounce) package cream cheese'
			}, {
				title: 'Crock Pot Cream Cheese Chicken',
				description: 'Place chicken pieces in crock pot and sprinkle Italian seasoning over chicken. Sprinkle with 2 tablespoons melted butter.\n\nCook on low for 4-6 hours.\n\nMelt 2 tablespoons butter in a sauce pan and saute onion and garlic. Add Cream of Chicken Soup, cream cheese, and chicken broth. Stir until smooth.\n\nAdd this mixture to crock pot and cook on low for an additional hour.\n\nIngredients:\n\n3 lbs chicken pieces\n1 (2/3 ounce) package Italian salad dressing mix\n4 tablespoons melted butter (divided)\n1 small onion, chopped\n1 garlic clove, chopped\n1 (10 1/2 ounce) can cream of chicken soup\n8 ounces cream cheese\n1⁄2 cup chicken broth'
			}, {
				title: 'Italian Sausage Vegetable Soup',
				description: 'Use bulk sausage or remove the casings from the sausage and discard.\n\nBrown the sausage in a heavy Dutch oven or large saucepan, mashing it with the back of a spoon until the meat is no longer pink and has rendered most of its fat.\n\nSpoon out most of the fat from the cooked sausage and discard.\n\nAdd the onions and garlic and cook, stirring,until soft but not browned.\n\nAdd carrots, zucchini, pepper, wine, tomatoes, basil, and oregano and bring to a boil.\n\nWhen the soup in boiling, add the orzo and cook for 20 minutes.\n\nSeason to taste with salt and pepper.\n\nServe in heavy soup bowls.\n\nIf desired, sprinkle Parmesan cheese over each serving.\n\nTo prepare in advance: Like most hearty soups, this tastes best if it is cooled, refrigerated overnight, then reheated to serve.\n\nIt may also be frozen.\n\nIngredients:\n\n1 lb Italian sausage\n1 medium onion, finely chopped\n1 clove garlic, minced\n2 carrots, peeled/ diced\n2 small zucchini, diced\n1 green pepper, diced\n1⁄2 cup dry white wine\n1 (28 ounce) cancrushed tomatoes, in tomato puree\n1 teaspoon dried basil, crumbled\n1⁄2 teaspoon dried oregano\nsalt\nfreshly ground pepper\n1⁄2 cup uncooked orzo pasta (rice-shaped pasta)\n2⁄3 cup freshly grated parmesan cheese'
			}]);
		};
	});

	it('creates search query', function() {
		var query = helper.app.models.Recipe.getTable().createSearchStatement('chicken');
		assert.equal(query.toString(), 'select "recipes"."id", "recipes"."title", "recipes"."description" from "recipes" where "recipes"."id" in (select "id" from "recipes" where _search @@ to_tsquery(\'chicken\'))');
	});

	it('can search "chicken"', function() {
		return helper.app.models.Recipe.search('chicken')
			.then(function(recipes) {
				assert.equal(recipes.length, 2);
			});
	});

	it('can search "soup"', function() {
		return helper.app.models.Recipe.search('soup')
			.then(function(recipes) {
				assert.equal(recipes.length, 2);
			});
	});

	it('cannot search "foo"', function() {
		return helper.app.models.Recipe.search('foo')
			.then(function(recipes) {
				assert.equal(recipes.length, 0);
			});
	});

	it('can update recipe', function() {
		return helper.app.models.Recipe.findOne({title: 'Crock-Pot Chicken With Black Beans & Cream Cheese'})
			.then(function(recipe) {
				recipe.title = 'Spaghetti';
				return recipe.save();
			})
			.then(function() {
				return helper.app.models.Recipe.search('spaghetti');
			})
			.then(function(recipes) {
				assert.equal(recipes.length, 1);
			});
	});

	it('can search multiple keywords', function() {
		return helper.app.models.Recipe.search('chicken cheese')
			.then(function(recipes) {
				assert.equal(recipes.length, 2);
			});
	});

	it('can use custom parser', function() {
		helper.app.models.Recipe.searchConfig = function() {
			return {
				parser: function(text) {
					return text.replace(' without ', ' !').split(' ').join(' & ');
				},
				properties: ['title', 'description']
			};
		};

		return helper.app.models.Recipe.search('soup without Parmesan')
			.then(function(recipes) {
				assert.equal(recipes.length, 1);
				assert.equal(recipes[0].title, 'Crock Pot Cream Cheese Chicken');
			});
	});
});

/* global describe, beforeEach, afterEach, before, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');
var Q = require('q');

describe('models find many-to-many', function() {
    beforeEach(helper.beforeEach());
    afterEach(helper.afterEach());

    before(function() {
        helper.setup = function(app) {
            app.models.Recipe = 'Recipe';
            app.models.RecipeIngredient = 'RecipeIngredient';
            app.models.Ingredient = 'Ingredient';
            app.models.Tag = 'Tag';

            function Ingredient() {
                this.title = [this.String];
                this.recipeIngredient = [this.HasMany(this.models.RecipeIngredient)];
                this.tags = [this.HasMany(this.models.Tag), this.AutoFetch];
            }
            app.model(Ingredient);

            function Recipe() {
                this.title = [this.String];
                this.description = [this.String];
                this.cookingMinutes = [this.Integer];
                this.imageLink = [this.String];
                this.ingredients = [this.HasMany(this.models.RecipeIngredient), this.AutoFetch];
                this.tags = [this.HasMany(this.models.Tag), this.AutoFetch];
            }
            app.model(Recipe);

            function RecipeIngredient() {
                this.amount = [this.String];
                this.amountType = [this.String];
                this.discount = [this.Decimal(4,2)];
                this.recipe = [this.BelongsTo(this.models.Recipe), this.Required];
                this.ingredient = [this.BelongsTo(this.models.Ingredient), this.AutoFetch];
            }
            app.model(RecipeIngredient);

            function Tag() {
                this.title = [this.String];
                this.imageLink = [this.String];
                this.canBeRated = [this.Boolean];
                this.recipes = [this.HasMany(this.models.Recipe)];
                this.ingredients = [this.HasMany(this.models.Ingredient)];
            }
            app.model(Tag);
        };

        helper.createModels = function(app) {
            return app.models.Recipe.create({
                title: '',
                description: '',
                cookingMinutes: 60,
                imageLink: ''
            })
            .then(function(recipe) {
                return Q.all([
                    app.models.Ingredient.create({
                        title: 'Test'
                    }),
                    recipe
                ]);
            })
            .spread(function(ingredient, recipe) {
                return Q.all([
                    app.models.RecipeIngredient.create({
                        amount: '',
                        amountType: '',
                        discount: 10.00,
                        recipe: recipe,
                        ingredient: ingredient
                    }),
                    app.models.RecipeIngredient.create({
                        amount: '',
                        amountType: '',
                        discount: 10.00,
                        recipe: recipe,
                        ingredient: ingredient
                    }),
                    recipe
                ]);
            })
            .spread(function(recipeIngredient, recipeIngredient2, recipe) {
                return Q.all([
                    recipe.createTag({
                        title: 'Test Tag',
                        imageLink: '',
                        canBeRated: true
                    })/*,
                    recipe.createTag({
                        title: 'Test Tag 2',
                        imageLink: '',
                        canBeRated: true
                    })*/
                ]);
            });
        };
    });

    it('can find correct number of tags', function() {
        return helper.app.models.Recipe.findOne()
            .then(function(recipe) {
                assert.equal(recipe.tags.length, 1);
                //assert.equal(recipe.ingredients[0].ingredients.tags.length, 1);
            });
    });
});

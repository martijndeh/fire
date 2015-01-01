/* global describe, beforeEach, afterEach, before, it */
'use strict';

var helper = require('./support/helper');
var assert = require('assert');

describe('models find auto fetch depth', function() {
	beforeEach(helper.beforeEach());
	afterEach(helper.afterEach());

	before(function() {
		helper.setup = function(app) {
			function Tester1(Tester2Model) {
				this.name = [this.String];
				this.testers2 = [this.HasMany(Tester2Model), this.AutoFetch];
			}
			app.model(Tester1);

			function Tester2(Tester1Model, Tester3Model) {
				this.name = [this.String];
				this.tester1 = [this.BelongsTo(Tester1Model), this.Required];
				this.testers3 = [this.HasMany(Tester3Model), this.AutoFetch];
			}
			app.model(Tester2);

			function Tester3(Tester2Model, Tester4Model) {
				this.name = [this.String];
				this.tester2 = [this.BelongsTo(Tester2Model), this.Required];
				this.testers4 = [this.HasMany(Tester4Model), this.AutoFetch];
			}
			app.model(Tester3);

			function Tester4(Tester3Model, Tester5Model) {
				this.name = [this.String];
				this.tester3 = [this.BelongsTo(Tester3Model), this.Required];
				this.testers5 = [this.HasMany(Tester5Model), this.AutoFetch];
			}
			app.model(Tester4);

			function Tester5(Tester4Model) {
				this.name = [this.String];
				this.tester4 = [this.BelongsTo(Tester4Model), this.Required];
			}
			app.model(Tester5);
		};

		helper.createModels = function(app) {
			return app.models.Tester1.create({name: 'Tester 1'})
				.then(function(tester1) {
					return app.models.Tester2.create({name: 'Tester 2', tester1: tester1});
				})
				.then(function(tester2) {
					return app.models.Tester3.create({name: 'Tester 3', tester2: tester2});
				})
				.then(function(tester3) {
					return app.models.Tester4.create({name: 'Tester 4', tester3: tester3});
				})
				.then(function(tester4) {
					return app.models.Tester5.create({name: 'Tester 5', tester4: tester4});
				});
		};
	});

	it('can find', function() {
		return helper.app.models.Tester1.find({})
			.then(function(testers1) {
				assert.equal(testers1.length, 1);
				assert.equal(testers1[0].testers2.length, 1);
				assert.equal(testers1[0].testers2[0].testers3.length, 1);
				assert.equal(testers1[0].testers2[0].testers3[0].testers4.length, 1);
				assert.equal(testers1[0].testers2[0].testers3[0].testers4[0].testers5.length, 1);
			});
	});
});

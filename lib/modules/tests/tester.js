exports = module.exports = Tester;

function Tester(app, testMap) {
	this.app = app;
	this.map = testMap;
}

Tester.prototype.getTest = function() {
	var whereMap = {};

	if(this.map.id) {
		whereMap.id = this.map.id;
	}
	else {
		whereMap.name = this.map.name;
	}

	return this.app.models.Test.getOne(whereMap);
};

Tester.prototype.getVariant = function(id) {
	var self = this;
	return this.getTest()
		.then(function(test) {
			return self.app.models.TestParticipant.findOne({id: id})
				.then(function(participant) {
					return self.app.models.TestSession.findOne({participant: participant, test: test});
				})
				.then(function(session) {
					if(session) {
						return session.variant;
					}
					else {
						return null;
					}
				});
		});
};

Tester.prototype.participate = function(id) {
	var self = this;
	return this.getTest()
		.then(function(test) {
			return self.app.models.TestParticipant.findOrCreate({id: id})
				.then(function(participant) {
					return self.app.models.TestSession.findOne({participant: participant, test: test})
						.then(function(session) {
							if(session) {
								return session;
							}
							else {
								return self.app.models.execute('WITH variants AS (SELECT id FROM test_variants WHERE test_id = ? ORDER BY number_of_participants ASC, name ASC LIMIT 1) UPDATE test_variants SET number_of_participants = number_of_participants + 1 WHERE id IN (SELECT id FROM variants) RETURNING *', [test.id])
									.then(function(variants) {
										if(variants.length) {
											var variant = variants[0];

											return self.app.models.TestSession.create({participant: participant, test: test, variant: variant.name});
										}
										else {
											throw new Error('Could not create a variant for test.');
										}
									});
							}
						});
				});
		});
};

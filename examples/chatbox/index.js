'use strict';

/**
 * This is Chatbox. A Node on Fire example app to showcase the stream functionality.
 *
 * We include a couple of modules: angular-route and angular-moment. And we require an additional module: jquery. This is automatically added to the bundle in the build stage.
 *
 * We can also pass additional key-value pairs to the settings object. These becomes available as variables in your templates.
 */
var app = require('fire')('chatbox', {
	modules: ['angular-route', 'angular-moment'],
	require: ['node_modules/jquery/dist/jquery.js'],
	NODE_ENV: process.env.NODE_ENV
});

/**
 * We create a User model.
 *
 * We set the email as the authenticate property, which makes the user our authenticator. This means users can register and sign in using this model. This automatically creates a password, access token and some more useful properties and methods.
 *
 * We create a link to an avatar url.
 *
 * We also create a one-to-many relationship from user to messages.
 */
function User(MessageModel) {
	this.email = [this.String, this.Authenticate];
	this.name = [this.String, this.Required];
	this.avatarUrl = [this.String, this.Required, this.CanUpdate(false)];
	this.messages = [this.HasMany(MessageModel)];
}
app.model(User);

/**
 * We define the access control of the user.
 *
 * - No one can read any or all the users.
 * - Only unauthenticated users can create a new user. Signed in users cannot create new users.
 */
User.prototype.accessControl = function() {
	return {
		canRead: function() {
			return false;
		},

		canCreate: function(authenticator) {
			return !authenticator;
		}
	};
};

/**
 * This is the user model's before create hook, which is invoked before the user is created and stored in the datastore.
 *
 * Here we set the avatarUrl by using Gravatar's system.
 */
User.prototype.beforeCreate = function() {
	var crypto = require('crypto');
	var hash = crypto.createHash('md5');
	hash.update(this.email.toLowerCase().replace(/^\s+|\s+$/g, ''));
	this.avatarUrl = '//www.gravatar.com/avatar/' + hash.digest('hex');
};

/**
 * The message model. This model belongs to user and is part of the one-to-many relationship.
 *
 * We set a createdAt date time property which is automatically set to the creation date time.
 * The text of the message is the actually contents of the message, or the text.
 */
function Message(UserModel) {
	this.user = [this.BelongsTo(UserModel), this.AutoFetch(['name', 'avatarUrl'])];
	this.createdAt = [this.DateTime, this.Default('CURRENT_TIMESTAMP')];
	this.text = [this.String, this.Required];
}
app.model(Message);

/**
 * Everyone can read all messages, and users can only create their own messages.
 */
Message.prototype.accessControl = function() {
	return {
		canRead: function() {
			return true;
		},

		canCreate: function(authenticator) {
			return {
				user: authenticator
			};
		}
	};
};

/**
 * We make sure the message's user is set to the current user.
 */
Message.prototype.beforeCreate = function(authenticator) {
	this.user = authenticator;
};

/**
 * The start controller which creates a stream of messages.
 */
function StartController($scope, user, MessageModel, UserModel, $window) {
	$scope.user = user;
	$scope.messageStream = MessageModel.stream({}, {orderBy:{createdAt: 1}});

	$scope.createMessage = function(text) {
		if(!$scope.user) {
			$window.alert('Please sign in before sending messages.');
		}
		else {
			return MessageModel.create({text: text})
				.then(function() {
					$scope.text = '';
					$scope.chatForm.$setPristine();
				})
				.catch(function() {
					$window.alert('Aye, some things went wrong. Can you try again?');
				});
		}
	};

	$scope.createUser = function(email, name, password) {
		return UserModel.create({email: email, name: name, password: password})
			.then(function(user) {
				$scope.user = user;
			})
			.catch(function() {
				$window.alert('This email is already in use. Do you want to login instead?');
			});
	};
}
app.controller('/', StartController);

StartController.prototype.resolve = function() {
	return {
		user: function(UserModel) {
			return UserModel.findMe();
		}
	};
};

/**
 *
 */
app.directive(function autoFocus() {
    var $ = require('jquery');
    return function(scope, element) {
        $(element).focus();
    };
});

app.directive(function autoScroll() {
	var $ = require('jquery');
	return {
		restrict: 'A',
		link: function(scope, element, attributes) {
			scope.$watch(attributes.autoScroll, function() {
				$(element).scrollTop($(element).prop('scrollHeight'));
			});
		}
	};
});

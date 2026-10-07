export default function routes() {
  // The public API: anyone can read, and private posts stay hidden (see
  // `app/controllers/application.js`).
  this.resource('actions', {
    only: ['show', 'index']
  });

  this.resource('comments');

  this.resource('friendships', {
    only: ['create', 'destroy']
  });

  this.resource('notifications', {
    only: ['show', 'index']
  });

  this.resource('posts');
  this.resource('reactions');
  this.resource('tags');

  // POST /users/login => UsersController#login
  this.resource('users', function () {
    this.collection(function () {
      this.post('login');
    });
  });

  // /admin/* — sees everything, with its own controllers and serializers.
  this.namespace('admin', function () {
    this.resource('actions');
    this.resource('comments');
    this.resource('friendships');
    this.resource('notifications');
    this.resource('posts');
    this.resource('reactions');
    this.resource('tags');
    this.resource('users');
  });

  // /members/* — a narrower API with stricter visibility rules. Only the
  // types listed here are served (or included) under /members.
  this.namespace('members', function () {
    this.resource('comments');
    this.resource('posts');
    this.resource('reactions', {
      only: ['show', 'index']
    });
    this.resource('tags', {
      only: ['show', 'index']
    });
    this.resource('users', {
      only: ['show', 'index']
    });
  });
}

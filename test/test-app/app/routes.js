export default function routes() {
  // A plain route outside any resource: ApplicationController#webhooks.
  this.post('webhooks');

  this.resource('actions', {
    only: ['show', 'index']
  });

  this.resource('comments');

  this.resource('friendships', {
    only: ['create', 'destroy']
  });

  this.resource('health', {
    only: ['index']
  });

  this.resource('custom', {
    only: []
  }, function(){
    this.get('/', 'index');
  });

  this.resource('images');

  // String ids, which the database cannot generate: no `create`.
  this.resource('languages', {
    only: ['show', 'index', 'update', 'destroy']
  });

  this.resource('notifications', {
    only: ['show', 'index']
  });

  this.resource('posts', function () {
    this.collection(function () {
      this.get('recent');
    });

    // Plain routes: neither `member` nor `collection`.
    this.get('featured');
    this.get('top-rated', 'topRated');
    this.post('echo');
  });
  this.resource('reactions');
  this.resource('tags');

  this.resource('users', function () {
    this.collection(function () {
      this.post('login');
    });
  });

  this.namespace('admin', function () {
    this.resource('actions');
    this.resource('comments');
    this.resource('friendships');
    this.resource('images');
    this.resource('notifications');
    this.resource('posts');
    this.resource('reactions');
    this.resource('tags');
    this.resource('users');
  });

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

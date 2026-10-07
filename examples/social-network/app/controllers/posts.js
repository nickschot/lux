import { Controller } from 'lumen-framework';

class PostsController extends Controller {
  // Attributes and relationships a client may write. Anything else in a
  // request body is dropped (attributes) or rejected (relationships).
  params = [
    'user',
    'body',
    'title',
    'isPublic'
  ];

  // `sort` and `filter` default to every attribute the serializer exposes;
  // narrowing them keeps clients to what the database can do cheaply.
  sort = [
    'title',
    'createdAt'
  ];

  filter = [
    'title'
  ];

  // GET /posts?page[size]=… is capped at this (the default is 100).
  maxPerPage = 50;
}

export default PostsController;

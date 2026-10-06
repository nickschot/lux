import PostsSerializer from '../posts';

// A post's comments and reactions can be many: members get them as links to
// load on demand, unless they `include` them.
class MembersPostsSerializer extends PostsSerializer {
  linksOnly = [
    'comments',
    'reactions'
  ];
}

export default MembersPostsSerializer;

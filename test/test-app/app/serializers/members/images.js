import ImagesSerializer from '../images';

// Members do not see image URLs. `members` has no images controller, so an
// image only reaches them included in another resource — never through a
// related endpoint (`/members/posts/1/image`), which would need one.
class MembersImagesSerializer extends ImagesSerializer {
  attributes = [];
}

export default MembersImagesSerializer;

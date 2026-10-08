import { Model } from 'LUMEN_LOCAL';

import Comment from './comment';
import Notification from './notification';
import Post from './post';
import Reaction from './reaction';
import User from './user';

const createMessageTemplate = resourceType => (name, reactionType) => (
  `${name} reacted to your ${resourceType} with ${reactionType}`
);

/* TODO: Add support for polymorphic relationship to a 'trackable'.
 * https://github.com/postlight/lux/issues/75
 */
class Action extends Model {
  static hooks = {
    async afterCreate(action, trx) {
      await action.notifyOwner(trx);
    }
  };

  async notifyOwner(trx) {
    const { trackableId, trackableType } = this;

    if (trackableType === 'Comment') {
      const trackable = await Comment
        .transacting(trx)
        .first()
        .select('postId', 'userId')
        .where({ id: trackableId });

      if (trackable) {
        const [user, post] = await Promise.all([
          User
            .transacting(trx)
            .first()
            .select('name')
            .where({ id: trackable.userId }),
          Post
            .transacting(trx)
            .first()
            .select('userId')
            .where({ id: trackable.postId })
        ]);

        if (user && post) {
          await Notification
            .transacting(trx)
            .create({
              message: `${user.name} commented on your post!`,
              recipientId: post.userId
            });
        }
      }
    } else if (trackableType === 'Reaction') {
      let reactableId;
      let createMessage;
      let ReactableModel;

      const reaction = await Reaction
        .transacting(trx)
        .first()
        .where({ id: trackableId });

      if (reaction) {
        if (!reaction.postId) {
          ReactableModel = Comment;
          createMessage = createMessageTemplate('comment');
          reactableId = reaction.commentId;
        } else {
          ReactableModel = Post;
          createMessage = createMessageTemplate('post');
          reactableId = reaction.postId;
        }

        const [user, reactable] = await Promise.all([
          User
            .transacting(trx)
            .first()
            .select('name')
            .where({ id: reaction.userId }),
          ReactableModel
            .transacting(trx)
            .first()
            .select('userId')
            .where({ id: reactableId })
        ]);

        if (user && reactable) {
          await Notification
            .transacting(trx)
            .create({
              message: createMessage(user.name, reaction.type),
              recipientId: reactable.userId,
            });
        }
      }
    }
  }
}

export default Action;

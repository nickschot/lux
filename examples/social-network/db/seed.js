import { faker } from '@faker-js/faker';

import Categorization from '../app/models/categorization';
import Comment from '../app/models/comment';
import Post from '../app/models/post';
import Reaction, { REACTION_TYPES } from '../app/models/reaction';
import Tag from '../app/models/tag';
import User from '../app/models/user';
import Friendship from '../app/models/friendship';

import range from '../app/utils/range';

const {
  person,
  lorem,
  datatype,
  internet,
  helpers: {
    arrayElement
  }
} = faker;

export default async function seed(trx) {
  await Promise.all(
    Array.from(range(1, 100)).map(() => (
      User.transacting(trx).create({
        name: `${person.firstName()} ${person.lastName()}`,
        email: internet.email(),
        password: internet.password({ length: arrayElement([...range(8, 127)]) })
      })
    ))
  );

  await Promise.all(
    Array.from(range(1, 100)).map(() => (
      Friendship.transacting(trx).create({
        followerId: arrayElement([...range(1, 100)]),
        followeeId: arrayElement([...range(1, 100)])
      })
    ))
  );

  await Promise.all(
    Array.from(range(1, 100)).map(() => (
      Post.transacting(trx).create({
        body: lorem.paragraphs(),
        title: lorem.sentence(),
        userId: arrayElement([...range(1, 100)]),
        isPublic: datatype.boolean()
      })
    ))
  );


  await Promise.all(
    Array.from(range(1, 100)).map(() => (
      Tag.transacting(trx).create({
        name: lorem.word()
      })
    ))
  );

  await Promise.all(
    Array.from(range(1, 100)).map(() => (
      Categorization.transacting(trx).create({
        postId: arrayElement([...range(1, 100)]),
        tagId: arrayElement([...range(1, 100)])
      })
    ))
  );

  await Promise.all(
    Array.from(range(1, 100)).map(() => (
      Comment.transacting(trx).create({
        message: lorem.sentence(),
        edited: datatype.boolean(),
        userId: arrayElement([...range(1, 100)]),
        postId: arrayElement([...range(1, 100)])
      })
    ))
  );

  await Promise.all(
    Array.from(range(1, 100)).map(() => (
      Reaction.transacting(trx).create({
        [`${arrayElement(['comment', 'post'])}Id`]: arrayElement([...range(1, 100)]),
        userId: arrayElement([...range(1, 100)]),
        kind: arrayElement(REACTION_TYPES)
      })
    ))
  );
};

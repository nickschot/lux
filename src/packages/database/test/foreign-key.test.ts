import { describe, it, beforeAll, afterAll, expect } from 'vitest';

import type { Model, ModelClass } from '../index';
import { readAttribute } from '../model/utils/attribute';
import { getTestApp } from '../../../../test/utils/get-test-app';

// The test-app's authors, books and shelves declare `foreignKey` for columns
// that don't follow Lumen's naming: `books.written_by`, and
// `placements(item_id, shelf_ref)` joining books to shelves.
describe('relationship option `foreignKey`', () => {
  let Author: ModelClass;
  let Book: ModelClass;
  let Shelf: ModelClass;
  let Placement: ModelClass;
  let author: Model;
  let book: Model;
  let shelf: Model;

  const idOf = (record: Model) => record.getPrimaryKey();
  const ids = (records: unknown) => (records as Array<Model>).map(idOf).sort();

  beforeAll(async () => {
    const { models } = await getTestApp();

    Author = models.get('author') as ModelClass;
    Book = models.get('book') as ModelClass;
    Shelf = models.get('shelf') as ModelClass;
    Placement = models.get('placement') as ModelClass;

    author = (await Author.create({ name: 'Ada' })).unwrap();
    shelf = (await Shelf.create({ name: 'Fiction' })).unwrap();
    book = (
      await Book.create({ title: 'Notes', writer: author, shelves: [shelf] })
    ).unwrap();
  });

  afterAll(async () => {
    await Placement.table()
      .whereIn('item_id', [idOf(book)])
      .del();
    await Promise.all([book, shelf, author].map(record => record.destroy()));
  });

  it('writes a belongsTo to the declared column', async () => {
    const [row] = await Book.table().where('id', idOf(book)).select();

    expect(row.written_by).to.equal(idOf(author));
    expect(readAttribute(book, 'writtenBy')).to.equal(idOf(author));
  });

  it('reads a belongsTo through it', async () => {
    const found = await Book.find(idOf(book));

    expect(idOf((await readAttribute(found, 'writer')) as Model)).to.equal(
      idOf(author)
    );
  });

  it("gives the hasMany side the belongsTo's column", async () => {
    expect(Author.relationshipFor('books')?.foreignKey).to.equal('written_by');

    const found = await Author.find(idOf(author));

    expect(ids(await readAttribute(found, 'books'))).to.deep.equal([
      idOf(book)
    ]);
  });

  it('includes a hasMany through it', async () => {
    const [found] = (await Author.where({ id: idOf(author) }).include(
      'books'
    )) as Array<Model>;

    expect(ids(await readAttribute(found, 'books'))).to.deep.equal([
      idOf(book)
    ]);
  });

  it('writes a many-to-many to the declared join columns', async () => {
    const rows = await Placement.table()
      .where('item_id', idOf(book))
      .select('item_id', 'shelf_ref');

    expect(rows).to.deep.equal([
      { item_id: idOf(book), shelf_ref: idOf(shelf) }
    ]);
  });

  it('reads and includes a many-to-many through them', async () => {
    const foundShelf = await Shelf.find(idOf(shelf));

    expect(ids(await readAttribute(foundShelf, 'books'))).to.deep.equal([
      idOf(book)
    ]);

    const [foundBook] = (await Book.where({ id: idOf(book) }).include(
      'shelves'
    )) as Array<Model>;

    expect(ids(await readAttribute(foundBook, 'shelves'))).to.deep.equal([
      idOf(shelf)
    ]);
  });
});

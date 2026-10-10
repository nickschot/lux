// Relationships whose foreign keys don't follow Lumen's naming, declared
// with `foreignKey`: books name their author in `written_by`, and are
// placed on shelves through `placements(item_id, shelf_ref)`.
export function up(schema) {
  return schema
    .createTable('authors', table => {
      table.increments('id');
      table.string('name');
      table.timestamps();
    })
    .createTable('books', table => {
      table.increments('id');
      table.string('title');
      table.integer('written_by').index();
      table.timestamps();
    })
    .createTable('shelves', table => {
      table.increments('id');
      table.string('name');
      table.timestamps();
    })
    .createTable('placements', table => {
      table.increments('id');
      table.integer('item_id').index();
      table.integer('shelf_ref').index();
      table.timestamps();
    });
}

export function down(schema) {
  return schema
    .dropTable('placements')
    .dropTable('shelves')
    .dropTable('books')
    .dropTable('authors');
}

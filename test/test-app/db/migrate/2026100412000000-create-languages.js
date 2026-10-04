// A resource keyed by a string (an IETF language tag such as `pt-BR`) rather
// than an auto-increment integer.
export function up(schema) {
  return schema.createTable('languages', table => {
    table.string('id').primary();

    table.string('name')
      .notNullable();

    table.timestamps();
  });
}

export function down(schema) {
  return schema.dropTable('languages');
}

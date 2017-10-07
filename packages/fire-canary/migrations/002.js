export function up(transaction) {
    transaction.sql `ALTER TABLE item ALTER COLUMN id SET DEFAULT uuid_generate_v4()`;
}

export function down(transaction) {
    transaction.sql `ALTER TABLE item ALTER COLUMN id DROP DEFAULT`;
}

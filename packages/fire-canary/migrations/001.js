export function up(transaction) {
    transaction.sql `CREATE TABLE item (
		id UUID PRIMARY KEY,
		created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
		name TEXT NOT NULL,
		count INTEGER DEFAULT 1 NOT NULL
	)`;
}

export function down(transaction) {
    transaction.sql `DROP TABLE item`;
}

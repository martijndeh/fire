import Lego from 'lego-sql';

export default class Model {
    internalTransaction = null;

    constructor() {
        //
    }

    transaction(transaction) {
        this.internalTransaction = transaction;
    }

    beginTransaction() {
        // TODO: If there is already an internalTransaction, it's probably best to use that one, right?
    }

    sql(strings, ...parameters) {
        const query = Lego.sql(strings, parameters);

        if (this.internalTransaction) {
            query.setTransaction(this.internalTransaction);
        }

        return query;
    }
}

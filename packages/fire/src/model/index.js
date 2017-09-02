import Lego from 'lego-sql';
import registerModel from 'sql-models';

export default class Model {
    internalTransaction = null;

    constructor() {
        registerModel(this.constructor);
    }

    transaction(transaction) {
        this.internalTransaction = transaction;
        return this;
    }

    beginTransaction(callback) {
        // TODO: If there is already an internalTransaction, it's probably best to use that one, right?
        return Lego.transaction(callback);
    }

    sql(strings, ...parameters) {
        const query = Lego.sql(strings, ...parameters);

        if (this.internalTransaction) {
            query.setTransaction(this.internalTransaction);
        }

        return query;
    }
}

import Store from '../index.js';

describe(`Store`, () => {
    it(`should construct`, () => {
        class MyStore extends Store {}

        const myStore = new MyStore();
        expect(myStore).toBeTruthy();
    });
});

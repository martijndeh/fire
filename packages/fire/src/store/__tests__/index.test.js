import store from '../index.js';

describe('@store', () => {
	it('should work', () => {
		@store
		class MyStore {}

        const myStore = new MyStore();
        expect(myStore).toBeTruthy();
	});
});

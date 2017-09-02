import Log from '../index.js';

describe(`log`, () => {
	it(`should log`, () => {
		const log = new Log(`fire:test`, 6, `*`);

        log.info(`This is a message.`);
        log.info(`This is another message.`);
	});
});

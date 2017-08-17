import { allow, deny, login, isAllowed } from '../server-service.js';

describe(`ServerService`, () => {
    const context = {
        request: {
            body: [],
        },
    };

    describe(`@allow`, () => {
        it(`should allow when @allow returns true`, async () => {
            class MyService {
                @allow(() => () => true)
                test() {}
            }

            const myService = new MyService();
            const allowed = await isAllowed(myService, `test`, context);

            expect(allowed).toBe(true);
        });

        it(`should disallow when @allow returns false`, async () => {
            class MyService {
                @allow(() => () => false)
                test() {}
            }

            const myService = new MyService();
            const allowed = await isAllowed(myService, `test`, context);

            expect(allowed).toBe(false);
        });

        it(`should disallow when @allow returns undefined`, async () => {
            class MyService {
                @allow(() => () => void 0)
                test() {}
            }

            const myService = new MyService();
            const allowed = await isAllowed(myService, `test`, context);

            expect(allowed).toBe(false);
        });
    });

    describe(`@deny`, () => {
        it(`should disallow when @deny returns true`, async () => {
            class MyService {
                @deny(() => () => true)
                test() {}
            }

            const myService = new MyService();
            const allowed = await isAllowed(myService, `test`, context);

            expect(allowed).toBe(false);
        });

        it(`should allow when @deny returns false`, async () => {
            class MyService {
                @deny(() => () => false)
                test() {}
            }

            const myService = new MyService();
            const allowed = await isAllowed(myService, `test`, context);

            expect(allowed).toBe(true);
        });

        it(`should disallow when @deny returns undefined`, async () => {
            class MyService {
                @deny(() => () => void 0)
                test() {}
            }

            const myService = new MyService();
            const allowed = await isAllowed(myService, `test`, context);

            expect(allowed).toBe(false);
        });
    });

    describe(`@login`, () => {
        it(`should allow when @login is set`, async () => {
            class MyService {
                @login
                test() {}
            }

            const myService = new MyService();
            const allowed = await isAllowed(myService, `test`, context);

            expect(allowed).toBe(true);
        });
    });

    describe(`multiple @allow, @deny`, () => {
        it(`should disallow when @allow returns true and @deny returns true`, async () => {
            class MyService {
                @allow(() => () => true)
                @deny(() => () => true)
                test() {}
            }

            const myService = new MyService();
            const allowed = await isAllowed(myService, `test`, context);

            expect(allowed).toBe(false);
        });

        it(`should disallow when @allow returns false and @deny returns true`, async () => {
            class MyService {
                @allow(() => () => false)
                @deny(() => () => true)
                test() {}
            }

            const myService = new MyService();
            const allowed = await isAllowed(myService, `test`, context);

            expect(allowed).toBe(false);
        });

        it(`should disallow when @allow returns false and @deny returns false`, async () => {
            class MyService {
                @allow(() => () => false)
                @deny(() => () => false)
                test() {}
            }

            const myService = new MyService();
            const allowed = await isAllowed(myService, `test`, context);

            expect(allowed).toBe(false);
        });

        it(`should allow when @allow returns true and @deny returns false`, async () => {
            class MyService {
                @allow(() => () => true)
                @deny(() => () => false)
                test() {}
            }

            const myService = new MyService();
            const allowed = await isAllowed(myService, `test`, context);

            expect(allowed).toBe(true);
        });
    });
});

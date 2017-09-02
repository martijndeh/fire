import { addInjectProvider, inject } from '..';

describe(`Injector`, () => {
    class Foo {}

    it(`should inject Foo`, () => {
        class Bar {}

        const NewBar = inject(Foo, `foo`)(Bar);
        expect(NewBar.WrappedComponent).toBe(Bar);
        expect(NewBar.OriginalClass).toBe(Bar);
        expect(NewBar.displayName).toBe(Bar.name);

        const bar = new NewBar();

        expect(bar.foo).toBeDefined();
    });

    it(`should inject Foo multiple times`, () => {
        class Bar1 {}
        class Bar2 {}

        const NewBar1 = inject(Foo, `foo`)(Bar1);
        const NewBar2 = inject(Foo, `foo`)(Bar2);
        const bar1 = new NewBar1();
        const bar2 = new NewBar2();

        expect(bar1.foo).toBe(bar2.foo);
    });

    it(`should not call default injector provider when injector provider is registered`, () => {
        class NewClass {}

        addInjectProvider(() => NewClass)

        class Bar {}

        const NewBar = inject(Foo, `foo`)(Bar);
        const newBar = new NewBar();

        expect(NewBar).toBe(NewClass);
        expect(newBar.foo).toBeUndefined();
    });
});

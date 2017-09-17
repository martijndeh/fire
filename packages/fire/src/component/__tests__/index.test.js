/* eslint-disable react/no-multi-comp */
import React from 'react';
import { isComponent } from '..';

describe(`component`, () => {
    it(`React.Component should be component`, () => {
        class MyComponent extends React.Component {}

        expect(isComponent(MyComponent)).toBe(true);
    });

    it(`Class should not be component`, () => {
        class SomeClass {}

        expect(isComponent(SomeClass)).toBe(false);
    });
});

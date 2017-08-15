/* eslint-disable react/no-multi-comp */
import React from 'react';
import component, { getPathForErrorCode, isComponent } from '..';

describe(`component`, () => {
    it(`React.Component should be component`, () => {
        class MyComponent extends React.Component {}

        expect(isComponent(MyComponent)).toBe(true);
    });

    it(`React.Component should not be component`, () => {
        class SomeClass {}

        expect(isComponent(SomeClass)).toBe(false);
    });

    it(`should get path for error code 404`, () => {
        class MyComponent extends React.Component {}

        component(`/404`, { error: 404 })(MyComponent);

        const path = getPathForErrorCode(404);

        expect(path).toBe(`/404`);
    });

    it(`should get path for from multiple error codes`, () => {
        class MyComponent extends React.Component {}

        component(`/error-page`, { error: [400, 401, 402, 403] })(MyComponent);

        const path = getPathForErrorCode(403);

        expect(path).toBe(`/error-page`);
    });
})

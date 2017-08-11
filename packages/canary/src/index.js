/* eslint-disable no-console */
import React from 'react';
import {
    component,
    service,
    store,
    inject,
    isClient,
    isServer,
} from 'fire';

if (isClient()) {
    // This is running on the client.
}
else if (isServer()) {
    // This is running on the server.
}

@service
class MyService {
    loadItems(test) {
        return [
            test,
            `Item #1`,
            `Item #2`,
            `Item #3`,
        ];
    }
}

@inject(MyService, `myService`)
@store
class MyStore {
    items = [];

    get numberOfItems() {
        return this.items.length;
    }

    async loadItems() {
        this.items = await this.myService.loadItems(`From the client :)`);
    }

    addItem() {
        this.items.push(`Item #${this.items.length + 1}`);
    }
}

@inject(MyStore, `myStore`)
@component(`/`)
export default class App extends React.Component {
    componentDidMount() {
        console.log(`App#componentDidMount`);
        console.log(this.props);

        this.props.myStore.loadItems();

        setInterval(() => this.props.myStore.addItem(), 1000 * 2);
    }

    render() {
        const {
            items,
            numberOfItems,
        } = this.props.myStore;

        return (
            <div>
                <h1>Hello, world!</h1>

                <p>There are {numberOfItems} items</p>
                {items.map((item) => <p key={item}>{item}</p>)}
            </div>
        );
    }
}

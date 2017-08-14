/* eslint-disable no-console */
/* eslint-disable react/no-multi-comp */
import React from 'react';
import {
    component,
    service,
    store,
    inject,
    isClient,
    isServer,
    login,
    guarded,
} from 'fire';

if (isClient()) {
    // This is running on the client.
}
else if (isServer()) {
    // This is running on the server.
}

@service
export class MyService {
    @login
    login(email) {
        if (email === `martijn@ff00ff.nl`) {
            return { id: 123 };
        }

        // TODO: Throw some error. Maybe use boom.errors?
    }

    @guarded((payload) => () => payload.id === 123)
    getItems() {
        return [
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
        this.items = await this.myService.getItems();

        console.log(this.items);
    }
}

@inject(MyService, `myService`)
@component(`/login`, { error: 401 })
export class Login extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            email: ``,
        };
    }

    handleChange = (event) => {
        this.setState({
            email: event.currentTarget.value,
        });
    }

    handleSubmit = (event) => {
        event.preventDefault();

        const {
            email,
        } = this.state;

        // TODO: How to handle errors?
        this.props.myService.login(email);
    };

    render() {
        return (
            <form onSubmit={this.handleSubmit}>
                <h1>Login</h1>
                <input type="email" onChange={this.handleChange} />
                <button>Submit</button>
            </form>
        );
    }
}

@inject(MyStore, `myStore`)
@component(`/`)
export default class App extends React.Component {
    componentDidMount() {
        console.log(`App#componentDidMount`);
        console.log(this.props.myStore);

        this.props.myStore.loadItems();
    }

    render() {
        console.log(`render again`);

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

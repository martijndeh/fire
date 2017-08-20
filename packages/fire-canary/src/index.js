/* eslint-disable no-console */
/* eslint-disable react/no-multi-comp */
import {
    component,
    service,
    store,
    inject,
    isClient,
    isServer,
    login,
    allow,
    React,
    style,
    setTheme,
} from 'fire';

if (isClient()) {
    // This is running on the client.
}
else if (isServer()) {
    // This is running on the server.
}

setTheme({
    magenta: `#f0f`,
});

@service
export class MyService {
    @login
    login(email) {
        if (email === `martijn@ff00ff.nl`) {
            return { id: 123 };
        }

        // TODO: Throw some error. Maybe use boom.errors?
    }

    @allow((payload) => () => payload && payload.id === 123)
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
        const response = await this.myService.getItems();
        this.items = await response.json();
    }
}

@style((theme) => ({
    button: {
        background: theme.magenta,
    },
}))
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
        const {
            classes,
        } = this.props;

        return (
            <form onSubmit={this.handleSubmit}>
                <h1>Login</h1>
                <input type="email" onChange={this.handleChange} />
                <button className={classes.button}>Submit</button>
            </form>
        );
    }
}

@inject(MyStore, `myStore`)
@component(`/`)
export default class App extends React.Component {
    componentDidMount() {
        this.props.myStore.loadItems();
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

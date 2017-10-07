/* eslint-disable react/no-multi-comp */
import {
    startup,
    Schema,
    Service,
    Store,
    Switch,
    Table,
    Route,
    inject,
    isClient,
    isServer,
    login,
    allow,
    React,
    style,
    setTheme,
} from 'fire';

startup(() => {
    if (isClient()) {
        // This is running on the client.
    }
    else if (isServer()) {
        // This is running on the server.
    }
});

class Item extends Table {
    static create(transaction) {
        transaction.sql `CREATE TABLE item (
            id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
            name TEXT NOT NULL,
            count INTEGER NOT NULL DEFAULT 1
        )`;
    }
}

Schema.addTableClasses([
    Item,
]);

setTheme({
    magenta: `#f0f`,
});

class MyService extends Service {
    @login
    login(email) {
        if (email === `martijn@ff00ff.nl`) {
            return { id: 123 };
        }

        // TODO: Throw some error. Maybe use boom.errors?
    }

    @allow((payload) => () => payload && payload.id === 123)
    getItems() {
        return this.schema.item.select `id, name, count`
                               .orderBy `created_at`
                               .limit `1000`;
    }
}

@inject(MyService, `myService`)
class MyStore extends Store {
    items = [];

    get numberOfItems() {
        return this.items.length;
    }

    async loadItems() {
        const response = await this.myService.getItems();

        if (response.ok) {
            this.items = await response.json();
        }
        else {
            this.history.push(`/login`);
        }
    }
}

@style((theme) => ({
    button: {
        background: theme.magenta,
    },
}))
@inject(MyService, `myService`)
class Login extends React.Component {
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

    handleSubmit = async (event) => {
        event.preventDefault();

        const {
            email,
        } = this.state;

        const response = await this.props.myService.login(email);

        if (response.ok) {
            this.props.history.push(`/`);
        }
        else {
            //
        }
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
class App extends React.Component {
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

class Router extends React.Component {
    render() {
        return (
            <Switch>
                <Route path="/login" component={Login} />
                <Route path="/" component={App} />
            </Switch>
        );
    }
}

startup(Router);

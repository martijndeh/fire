import Log from 'fire-log';
import ReactDOM from 'react-dom';
import React from 'react';
import { jss, ThemeProvider } from 'react-jss';
import normalize from 'jss-normalize';
import createBrowserHistory from 'history/createBrowserHistory';
import { Router } from 'react-router-dom';
import { getCallbacks, getComponents } from '../startup/index.js';
import { getTheme } from '../style/index.js';
import Store from '../store/index.js';

const log = new Log(`fire:client`);
const history = createBrowserHistory();
Store.setHistory(history);

// TODO: Or should we use JssProvider and create our own jss instance?
jss.createStyleSheet(normalize, { named: false }).attach();

class App extends React.Component {
    render() {
        const components = getComponents();

        if (components.length !== 1) {
            log.error(`There should be one startup component.`);

            throw new Error();
        }

        const Component = components[0];

        return (
            <ThemeProvider theme={getTheme()}>
                <Router history={history}>
                    <Component />
                </Router>
            </ThemeProvider>
        );
    }
}

ReactDOM.render(<App />, document.getElementById(`root`));

const callbacks = getCallbacks();

callbacks.forEach((callback) => callback());

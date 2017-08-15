import ReactDOM from 'react-dom';
import React from 'react';
import { ThemeProvider } from 'react-jss';
import createBrowserHistory from 'history/createBrowserHistory';
import { Router, Route, Switch } from 'react-router-dom';
import { getComponents } from '../component/index.js';
import { setHistory } from '../service/index.js';
import { getTheme } from '../style/index.js';

const history = createBrowserHistory();

// This is a bit hacky but will do for now.
setHistory(history);

class App extends React.Component {
    render() {
        const components = getComponents();

        return (
            <ThemeProvider theme={getTheme()}>
                <Router history={history}>
                    <Switch>
                        {Object.keys(components).map((path) => {
                            const {
                                props,
                                Component,
                            } = components[path];

                            return (
                                <Route key={path} exact path={path} component={Component} {...props} />
                            );
                        })}
                    </Switch>
                </Router>
            </ThemeProvider>
        );
    }
}

ReactDOM.render(<App />, document.getElementById(`root`));

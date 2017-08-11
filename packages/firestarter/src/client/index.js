import ReactDOM from 'react-dom';
import React from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import { getComponents } from '../component/index.js';

class App extends React.Component {
    render() {
        const components = getComponents();

        return (
            <Router>
                <Switch>
                    {Object.keys(components).map((path) => {
                        const {
                            props,
                            Component,
                        } = components[path];

                        return (
                            <Route key={path} path={path} component={Component} {...props} />
                        );
                    })}
                </Switch>
            </Router>
        );
    }
}

ReactDOM.render(<App />, document.getElementById(`root`));

import React from 'react';
import PropTypes from 'prop-types';

class LoginPage extends React.Component {
    static propTypes = {
        "signinHandler": PropTypes.func.isRequired,
    };

    componentDidMount() {
        window.gapi.load('client:auth2', () => {   
            // We only go to this page if we're already determined to be not logged in 
            // via App.js
            //
            // Do we need to check initial state or have a listener? 



            // Listen for sign-in state changes.
            window.gapi.auth2.getAuthInstance().isSignedIn.listen((signinStatus) => {
                const googleUser = signinStatus
                    ? window.gapi.auth2.getAuthInstance().currentUser.get()
                    : null;
                this.props.signinHandler(signinStatus, googleUser);
            });

            // Handle the initial sign-in state.
            const isSignedIn = window.gapi.auth2.getAuthInstance().isSignedIn.get();
            const googleUser = isSignedIn
                ? window.gapi.auth2.GoogleAuth.currentUser.get()
                : null;
            this.props.signinHandler(isSignedIn, googleUser);
        }, function(error) {
            console.log(error);
        });
    }

    handleAuthClick(event) {
        const signinPromise = window.gapi.auth2.getAuthInstance().signIn();
        signinPromise.then(
            (googleUser) => {
                this.props.signinHandler(true, googleUser);
            },
            (error) => {console.log(error)}
        );
    }

    render() {
        return(
            <div>
                <p>You are not signed in.</p>
                <button id="authorize_button" onClick={() => this.handleAuthClick(null)}>Authorize</button>
            </div>
        );
    }
}

export default LoginPage;

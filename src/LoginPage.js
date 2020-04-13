import React from 'react';
import PropTypes from 'prop-types';

class LoginPage extends React.Component {
    static propTypes = {
        "signinHandler": PropTypes.func.isRequired,
        "authCodeHandler": PropTypes.func.isRequired,
    };

    componentDidMount() {
        window.gapi.load('client:auth2', () => {
            // We only go to this page if we're already determined to be not logged in 
            // via App.js

            // Listen for sign-in state changes.
            // This is what triggers the main app to pull user profile info from Google
            window.gapi.auth2.getAuthInstance().isSignedIn.listen((signinStatus) => {
                this.props.signinHandler(signinStatus);
            });

        }, function (error) {
            console.log(error);
        });
    }

    handleAuthClick(event) {
        // Getting offline access permission also include the scopes asked for (calendar)
        // Pass off the auth code to set up server-side acccess
        window.gapi.auth2.getAuthInstance().grantOfflineAccess().then(authResult => {
            if ('code' in authResult) {
                this.props.authCodeHandler(authResult['code']);
            } else {
                console.log("Error while getting offline access");
            }
        });
    }

    render() {
        return (
            <div>
                <p>You are not signed in.</p>
                <button id="authorize_button" onClick={() => this.handleAuthClick(null)}>Authorize</button>
            </div>
        );
    }
}

export default LoginPage;

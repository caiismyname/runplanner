import React from 'react';
import PropTypes from 'prop-types';
import { Box, Heading, Grommet, Button } from 'grommet';
import { grommetTheme } from './configs';

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
            <Grommet 
                theme={grommetTheme}
                full
                background='dark-1'
            >
                <Box
                    justify='center'
                    align='center'
                    height='75%'
                    margin={{bottom:'25%'}}
                >
                    <Heading level={1} size='xlarge'>RunPlanner</Heading>
                    <Heading level={3} textAlign='center'>Easily create training plans that sync with your Google Calendar</Heading> 
                    <Button 
                        id="authorize_button" 
                        primary 
                        onClick={() => this.handleAuthClick(null)}
                        label='Authorize with Google'
                    />
                </Box>
            </Grommet>
        );
    }
}

export default LoginPage;

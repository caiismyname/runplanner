import React from 'react';
import PropTypes from 'prop-types';
import GoogleLogin from 'react-google-login';

import {gClientID} from './configs';

class LoginPage extends React.Component {
    static propTypes = {
        "signinHandler": PropTypes.func.isRequired,
    };

    render() {
        return(
            <div>
                <p>You are not signed in.</p>
                <GoogleLogin
                    clientId={gClientID}
                    buttonText="Login"
                    onSuccess={(res) => this.props.signinHandler(true, res)}
                    onFailure={(res) => this.props.signinHandler(false, res)}
                    cookiePolicy={"single_host_origin"}
                />
            </div>
        );
    }
}

export default LoginPage;

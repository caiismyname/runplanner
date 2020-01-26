import React from 'react';
import GoogleLogin from 'react-google-login';

class LoginPage extends React.Component {

    render() {
        return(
            <div>
                <p>You are not signed in.</p>
                <GoogleLogin
                    clientId="953053521176-om8kfj3ei7g0pm6dq6cohhhb7ucnhaje.apps.googleusercontent.com"
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

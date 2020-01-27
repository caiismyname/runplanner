import React from "react";
import PropTypes from 'prop-types';

class NewUserOnboarding extends React.Component {
    static propTypes = {
        "onboardingHandler": PropTypes.func.isRequired,
    };
    
    render() {
        return (
            <div>
                This is the onboarding flow

                <button onClick={() => this.props.onboardingHandler(2, "calendar", "America/Los_Angeles")}>Submit</button>
            </div>
        );
    }
}

export default NewUserOnboarding;
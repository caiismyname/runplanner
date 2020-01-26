import React from "react";

class NewUserOnboarding extends React.Component {

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
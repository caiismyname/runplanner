import React from "react";
import PropTypes from 'prop-types';

class NewUserOnboarding extends React.Component {
    static propTypes = {
        "onboardingHandler": PropTypes.func.isRequired,
    };

    listUpcomingEvents() {
        window.gapi.load('client:auth2', () => {   
            window.gapi.client.calendar.events.list({
                'calendarId': 'primary',
                'timeMin': (new Date()).toISOString(),
                'showDeleted': false,
                'singleEvents': true,
                'maxResults': 10,
                'orderBy': 'startTime'
            }).then(function(response) {
                var events = response.result.items;

                if (events.length > 0) {
                    for (let i = 0; i < events.length; i++) {
                        var event = events[i];
                        var when = event.start.dateTime;
                        if (!when) {
                            when = event.start.date;
                        }
                        return (event.summary + ' (' + when + ')');
                    }
                } else {
                    return ("nothing");
                };
            });
        });
    }
    
    render() {
        return (
            <div>
                This is the onboarding flow
                <button onClick={() => this.props.onboardingHandler(2, "calendar", "America/Los_Angeles")}>Submit</button>
                <div>
                    {this.listUpcomingEvents()}
                </div>
            </div>
        );
    }
}

export default NewUserOnboarding;
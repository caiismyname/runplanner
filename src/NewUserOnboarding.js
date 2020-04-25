import React from "react";
import PropTypes from 'prop-types';
import { Grommet, Main, Box, Tabs, Tab, Button, Heading, TextInput, Select, RadioButtonGroup} from 'grommet';
import { Add, Subtract, Share } from 'grommet-icons';
import { grommetTheme, defaultRunDurations, autofillDistributions } from './configs';

import TimeEntry from './TimeEntryModule';

var moment = require('moment-timezone');

class NewUserOnboarding extends React.Component {
    static propTypes = {
        "onboardingHandler": PropTypes.func.isRequired,
    };

    constructor(props) {
        super(props);

        this.updateStartTime = this.updateStartTime.bind(this);
        this.daysOfWeek = moment.weekdays();

        // These are the defaults. They are important
        this.state = {
            startOfWeek: 1,
            timezone: moment.tz.guess(),
            startTime: {
                hour: 7,
                minute: 0,
            },
            runDuration: 3,
            autofillDistribution: autofillDistributions.EVEN,
        }
    }

    generateStartTimeString() {
        // Technically this includes 'today's day, 
        // but it's never used since the hour/minute/period is parsed out
        // for separate storage.
        return (moment().hour(this.state.startTime.hour).minute(this.state.startTime.minute).toISOString());
    }

    updateStartTime(newTime) {
        const newHour = moment(newTime).hour() ;
        const newMinute = moment(newTime).minute();

        this.setState({
            startTime: {
                hour: newHour,
                minute: newMinute,
            }
        });
    }

    render() {
        return (
            <Grommet 
				theme={grommetTheme}
				full={true}
			>
                <Main
                    pad='large'
                    fill={true}
                    border={true}
                >
                    <Heading level={1}>Welcome to RunPlanner</Heading>
                    <Heading level={3}>Let's set some settings. If you're unsure of anything, the defaults will take care of you, and you can always change your settings later.</Heading>
                    <Box>
                        <Tabs
                            activeIndex={this.state.startOfWeek}
                            onActive={(index) => {this.setState({startOfWeek: index})}}
                        >
                            {this.daysOfWeek.map(day => <Tab title={day}/>)}
                        </Tabs>
                    </Box>

                    <Box>
                        <Select
                            // options={['', 'US/Eastern', 'US/Central', 'US/Mountain', 'US/Pacific', 'US/Arizona', 'US/Alaska', 'US/Hawaii']}
                            options={moment.tz.zonesForCountry('US')}
                            value={this.state.timezone}
                            onChange={(res) => {
                                this.setState({timezone: res.option});
                            }}
                        />
                    </Box>

                    <Box>
                        <Heading level={5}>Default start time</Heading>
                        <TimeEntry
                            date={this.generateStartTimeString()}
                            updateTimeCallback={(newTime => this.updateStartTime(newTime))}
                        />
                    </Box>

                    <Box>
                        <Heading level={5}>Default Run Duration</Heading>
                        <Tabs
                            activeIndex={this.state.runDuration}
                            onActive={(index) => {this.setState({runDuration: index})}}
                        >
                            {defaultRunDurations.map(duration => <Tab title={duration}/>)}
                        </Tabs>
                    </Box>

                    <Box>
                        <Heading level={5}>AutoFill Distribution</Heading>
                        <RadioButtonGroup
                            options={[...Object.values(autofillDistributions)]}
                            value={this.state.autofillDistribution}
                            onChange={e => this.setState({autofillDistribution: e.target.value})}
                        />
                    </Box>
                </Main>


            </Grommet>
        );
    }
}

export default NewUserOnboarding;
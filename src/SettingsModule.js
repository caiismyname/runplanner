import React from "react";
import PropTypes from 'prop-types';
import { Box, Tabs, Tab, Button, Heading, Select, RadioButtonGroup, Paragraph} from 'grommet';
import { 
    defaultRunDurations,
    autofillDistributions,
    defaultSettings,
} from './configs';

import TimeEntry from './TimeEntryModule';

var moment = require('moment-timezone');

class SettingsModule extends React.Component {
    static propTypes = {
        titleText: PropTypes.string.isRequired,
        subtitleText: PropTypes.string,
        submitHandler: PropTypes.func.isRequired,
        useDefaultSettings: PropTypes.bool.isRequired,
        existingSettings: PropTypes.shape({
            startingDayOfWeek: PropTypes.number,
            mainTimezone: PropTypes.string,
            defaultStartTime: PropTypes.shape({
                hour: PropTypes.number,
                minute: PropTypes.number,
            }),
            defaultRunDuration: PropTypes.number,
            autofillConfig: PropTypes.shape({
                autofillDistribution: PropTypes.string,
            }),
            defaultView: PropTypes.string,
        }),
    };

    constructor(props) {
        super(props);

        this.updateStartTime = this.updateStartTime.bind(this);
        this.daysOfWeek = moment.weekdays();

        if (this.props.useDefaultSettings) {
            this.state = defaultSettings;
        } else {
            this.state = {
                ...this.props.existingSettings,
            };
        }
    }

    generateStartTimeString() {
        // Technically this includes 'today's day, 
        // but it's never used since the hour/minute/period is parsed out
        // for separate storage.
        return (moment().hour(this.state.defaultStartTime.hour).minute(this.state.defaultStartTime.minute).toISOString());
    }

    updateStartTime(newTime) {
        const newHour = moment(newTime).hour() ;
        const newMinute = moment(newTime).minute();

        this.setState({
            defaultStartTime: {
                hour: newHour,
                minute: newMinute,
            }
        });
    }

    render() {
        return (
            <Box
                margin='auto'
                pad='large'
                overflow='scroll'
            >
                <Heading level={1} margin='none'>{this.props.titleText}</Heading>
                {this.props.subtitleText ? <Paragraph>{this.props.subtitleText}</Paragraph> : null }

                <Box width='medium'>
                    <Heading level={5}>Timezone</Heading>
                    <Select
                        // options={['', 'US/Eastern', 'US/Central', 'US/Mountain', 'US/Pacific', 'US/Arizona', 'US/Alaska', 'US/Hawaii']}
                        options={moment.tz.zonesForCountry('US')}
                        value={this.state.mainTimezone}
                        onChange={(res) => {
                            this.setState({mainTimezone: res.option});
                        }}
                    />
                </Box>

                <Box>
                    <Heading level={5}>Start of Week</Heading>
                    <Tabs
                        alignSelf='start'
                        activeIndex={this.state.startingDayOfWeek}
                        onActive={(index) => {this.setState({startingDayOfWeek: index})}}
                    >
                        {this.daysOfWeek.map(day => <Tab title={day} key={day}/>)}
                    </Tabs>
                </Box>

                <Box width='medium'>
                    <Heading level={5}>Default start time</Heading>
                    <TimeEntry
                        date={this.generateStartTimeString()}
                        updateTimeCallback={(newTime => this.updateStartTime(newTime))}
                    />
                </Box>

                <Box>
                    <Heading level={5}>Default Run Duration (minutes)</Heading>
                    <Tabs
                        alignSelf='start'
                        activeIndex={defaultRunDurations.indexOf(this.state.defaultRunDuration)}
                        onActive={(index) => {this.setState({defaultRunDuration: defaultRunDurations[index]})}}
                    >
                        {defaultRunDurations.map(duration => <Tab title={String(duration)} key={duration}/>)}
                    </Tabs>
                </Box>

                <Box>
                    <Heading level={5}>AutoFill Distribution</Heading>
                    <RadioButtonGroup
                        name='autofill distribution selector'
                        options={[...Object.values(autofillDistributions)]}
                        value={this.state.autofillConfig.distribution}
                        onChange={e => this.setState({autofillConfig: {distribution: e.target.value}})}
                    />
                </Box>

                <Box margin={{top: 'small'}} width='small'>
                    <Button 
                        label='Submit'
                        primary
                        onClick={() => this.props.submitHandler(this.state)}
                    />
                </Box>
            </Box>
        );
    }
}

export default SettingsModule;
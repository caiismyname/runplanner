import React from 'react';
import PropTypes from 'prop-types';
import { Box, Button, TextInput } from 'grommet';
import { timeFields } from './configs';

var moment = require('moment-timezone');

class TimeEntry extends React.Component {
	static propTypes = {
        // This takes a whole date and not just time so that you can 
        // pass a full date to it and it'll come out with the correct day.
        // If only dealing with time, the value of the date can be ignored.
        date: PropTypes.string.isRequired,
		updateTimeCallback: PropTypes.func.isRequired,
	};

	constructor(props) {
		super(props);

		this.state = {
			blankHour: false,
			blankMinute: false,
			minuteDisplayMode: "mm",
		}
	}

	generateDisplayHour() {
		return this.state.blankHour ? "" : moment(this.props.date).format("h");
	}

	generateDisplayMinute() {
		return this.state.blankMinute ? "" : moment(this.props.date).format(this.state.minuteDisplayMode);
	}

	generateDisplayPeriod() {
		return moment(this.props.date).format("a");
	}

	generateNewDateTime(field, value) {
		const oldTime = moment(this.props.date);

		if (field === timeFields.HOUR) {
			oldTime.hour(Number(value));
		} else if (field === timeFields.MINUTE) {
			oldTime.minute(Number(value));
		}

		return (oldTime.toISOString());
	}

	render() {
		const edit = 
			<Box
				direction='row'
				gap='xxsmall'
				align='center'
			>
				{/* Hour */}
				<div style={{width: '25%', fontSize: '3em'}}>
					<TextInput
						style={{textAlign: 'center'}}
						value={this.generateDisplayHour()}
						onChange={(e) => {
							const value = e.target.value.slice(0, 2);
							if (Number(value) > 12) {
								return;
							};

							if (value === "") {
								this.setState({ blankHour: true });
							} else {
								this.setState({ blankHour: false });
								this.props.updateTimeCallback(this.generateNewDateTime(timeFields.HOUR, value));
							};
						}}
					/>
				</div>
				{/* Minute */}
				<div style={{width: '25%', fontSize: '3em'}}>
					<TextInput
					    style={{textAlign: 'center'}}
						value={this.generateDisplayMinute()}
						onChange={(e) => {
							let value = e.target.value.slice(0, 2);
							if (Number(value) > 59) {
								return;
							}
							if (value === "") {
								this.setState({ blankMinute: true, minuteDisplayMode: "m" });
							} else {
								this.setState({ blankMinute: false, minuteDisplayMode: "m" });
								this.props.updateTimeCallback(this.generateNewDateTime(timeFields.MINUTE, value));
							};
						}}
						onBlur={() => this.setState({ minuteDisplayMode: "mm" })}
					/>
					</div>
				<div style={{width: '20%'}}>
					<Button
						onClick={() => {
							const hourAdjustment = this.generateDisplayPeriod() === "am" ? 12 : -12;
							const newHour = moment(this.props.date).hour() + hourAdjustment;
							this.props.updateTimeCallback(this.generateNewDateTime(timeFields.HOUR, newHour));
						}}
						label={this.generateDisplayPeriod()}
					/>
				</div>
			</Box>
		;
		return (edit);
	}
}

export default TimeEntry;
import React from 'react';
import PropTypes from 'prop-types';
import { Box, Button, Heading, TextInput, TextArea, FormField, RadioButtonGroup } from 'grommet';
import { Save } from 'grommet-icons';
import { workoutFields, timeFields, editModuleDateDisplayFormat, payloadPropType, workoutTypes, toSentenceCase } from './configs';

var moment = require('moment-timezone');

class EditWorkoutModule extends React.Component {
	static propTypes = {
		"id": PropTypes.string,
		"onClose": PropTypes.func.isRequired,
		"payload": payloadPropType,
		"show": PropTypes.bool.isRequired,
		"updateDayContentFunc": PropTypes.func.isRequired,
		'deleteWorkoutFunc': PropTypes.func.isRequired,
		'saveFunc': PropTypes.func.isRequired,
	};

	constructor(props) {
		super(props);
		this.handleWorkoutChange = this.handleWorkoutChange.bind(this);
		this.handleDelete = this.handleDelete.bind(this);
	}

	handleWorkoutChange(newValue, source) {
		let newPayload = { ...this.props.payload };
		if (source === workoutFields.MILAGE_ACTUAL) {
			newPayload.milage.actual = newValue;
		} else if (source === workoutFields.MILAGE_GOAL) {
			newPayload.milage.goal = newValue;
		} else {
			newPayload[source] = newValue;
		}

		this.props.updateDayContentFunc(this.props.id, newPayload);
	}

	handleDelete() {
		this.props.deleteWorkoutFunc(this.props.id);
		this.props.onClose();
	}

	render() {
		if (!this.props.show) {
			return (null);
		};

		return (
			<Box pad='small'>
				<Box alignSelf='start'>
					<Button 
						onClick={() => this.props.saveFunc()}
						label='Save'
						primary
						icon={<Save />}
					/>
				</Box>
				<br/>
				<Heading level={3} size='small' margin='xsmall'>
					{moment(this.props.payload.startDate).format(editModuleDateDisplayFormat)}
				</Heading>
				<Box>
					<TimeEntry
						date={this.props.payload.startDate}
						updateTimeCallback={(newDateTime) => {
							this.handleWorkoutChange(newDateTime, workoutFields.STARTDATE);
						}}
					/>
				</Box>
				<br/>
				<Box width='xsmall'>
					<FormField label='Mileage'>
						<TextInput 
							placeholder='Run Mileage'
							type='number'
							min='0'
							size='xlarge'
							// Convert value to string b/c otherwise, React reads 01 and 1 as the same
							// because it compares the value as numbers.
							value={String(this.props.payload.milage.goal)}
							onChange={(e) => {
								const input = e.target.value;
								let cleanedInput = input;
								if (input.length > 1 && input[0] === '0') {
									cleanedInput = input.slice(1);
								}
								this.handleWorkoutChange(Number(cleanedInput), workoutFields.MILAGE_GOAL)}
							}
						/>
					</FormField>
				</Box>
				<br/>
				<Box>
					<Heading level={3}>Notes</Heading>
					<TextArea
						value={this.props.payload.content} 
						onChange={(e) => this.handleWorkoutChange(e.target.value, workoutFields.CONTENT)}
					/>
				</Box>
				<br/>
				<Box>
					<RadioButtonGroup
						options={[...Object.values(workoutTypes)].map(x => toSentenceCase(x))}
						value={this.props.payload.type}
						onChange={(e) => {
							this.handleWorkoutChange(e.target.value, workoutFields.TYPE)
						}}
					/>
				</Box>

				<br/>
				{/* <button onClick={this.props.onClose}>Close</button> */}
				<Box
					alignSelf='start'
				>
					<Button onClick={this.handleDelete} label='Delete' secondary/>
				</Box>
			</Box>
		);
	}
}

class TimeEntry extends React.Component {
	static propTypes = {
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
				<div style={{width: '25%', fontSize: '3em'}}>
					<TextInput
					style={{textAlign: 'center'}}
						value={this.generateDisplayMinute()}
						onChange={(e) => {
							let value = e.target.value.slice(0, 2);
							if (Number(value) > 59) {
								return;
							}

							if (value === "" || value === "0") {
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

export default EditWorkoutModule;
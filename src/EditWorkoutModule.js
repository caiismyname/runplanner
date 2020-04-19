import React from 'react';
import PropTypes from 'prop-types';
import { Box, Button, Heading, TextInput, TextArea, FormField, RadioButtonGroup} from 'grommet';
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
			<Box
				pad='small'
			>
				<Box
					alignSelf='start'
				>
					<Button 
						onClick={() => this.props.saveFunc()}
						label='Save'
						primary
						icon={<Save />}
					/>
				</Box>
				<br/>
				<Box direction='row'>
					<TimeEntry
						date={this.props.payload.startDate}
						updateTimeCallback={(newDateTime) => {
							this.handleWorkoutChange(newDateTime, workoutFields.STARTDATE);
						}}
					/>
					<Heading level={3} margin='none'>
						{moment(this.props.payload.startDate).format(editModuleDateDisplayFormat)}
					</Heading>
				</Box>
				<br/>
				<Box width='xsmall'>
					<FormField label="Mileage">
						<TextInput 
							placeholder="Run Mileage"
							type="number"
							size='xlarge'
							value={this.props.payload.milage.goal}
							onChange={(e) => {
								this.handleWorkoutChange(Number(e.target.value), workoutFields.MILAGE_GOAL)}
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
				<button onClick={this.props.onClose}>Close</button>
				<button onClick={this.handleDelete}>Delete</button>
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
		return (
			<div style={{ display: "inline" }}>
				<textarea
					style={{ float: "left", width: "2em", height: "1em", resize: "none" }}
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
				<textarea
					style={{ float: "left", width: "2em", height: "1em", resize: "none" }}
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
				<button
					style={{ float: "left" }}
					onClick={() => {
						const hourAdjustment = this.generateDisplayPeriod() === "am" ? 12 : -12;
						const newHour = moment(this.props.date).hour() + hourAdjustment;
						this.props.updateTimeCallback(this.generateNewDateTime(timeFields.HOUR, newHour));
					}}
				>
					{this.generateDisplayPeriod()}
				</button>
			</div>
		);
	}
}

export default EditWorkoutModule;
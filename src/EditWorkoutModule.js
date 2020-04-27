import React from 'react';
import PropTypes from 'prop-types';
import { Box, Button, Heading, TextInput, TextArea, FormField, RadioButtonGroup } from 'grommet';
import { Save } from 'grommet-icons';
import { workoutFields, editModuleDateDisplayFormat, payloadPropType, workoutTypes } from './configs';
import TimeEntry from './TimeEntryModule';
import Loader from 'react-loader-spinner'

import { 
	brandColor,
	loaderTimeout,
} from './configs';

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

		this.state = {
			edited: false,
			isDeleting: false,
		}
	}

	handleWorkoutChange(newValue, source) {
		let newPayload = { ...this.props.payload };
		if (source === workoutFields.mileage_ACTUAL) {
			newPayload.mileage.actual = newValue;
		} else if (source === workoutFields.mileage_GOAL) {
			newPayload.mileage.goal = newValue;
		} else {
			newPayload[source] = newValue;
		}

		this.props.updateDayContentFunc(this.props.id, newPayload);
		this.setState({edited: true});
	}

	handleDelete() {
		this.setState({isDeleting: true});
		this.props.deleteWorkoutFunc(this.props.id, (isSuccess) => {
			this.setState({isDeleting: false});
			if (isSuccess) {
				this.props.onClose();
			} else {
				alert("Error deleting the run");
			}
		});
	}

	render() {
		if (!this.props.show) {
			return (null);
		};

		const deleteButton = 
			this.state.isDeleting
			? 				
				<Loader
					type="ThreeDots"
					color='status-critical'
					height='100%'
					timeout={loaderTimeout}
				/>
			: <Button onClick={this.handleDelete} label='Delete' secondary color='status-critical'/>;

		return (
			<Box pad='small'>
				<Box alignSelf='start'>
					<Button 
						onClick={() => {
							this.props.saveFunc();
							this.setState({edited: false});
						}}
						label='Save'
						primary
						icon={<Save />}
						style={this.state.edited ? {} : {visibility: 'hidden'}}
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
							value={String(this.props.payload.mileage.goal)}
							onChange={(e) => {
								const input = e.target.value;
								let cleanedInput = input;
								if (input.length > 1 && input[0] === '0') {
									cleanedInput = input.slice(1);
								}
								this.handleWorkoutChange(Number(cleanedInput), workoutFields.mileage_GOAL)}
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
						options={[...Object.values(workoutTypes)]}
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
					{deleteButton}
				</Box>
			</Box>
		);
	}
}

export default EditWorkoutModule;
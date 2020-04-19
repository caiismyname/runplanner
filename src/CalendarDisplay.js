import React from 'react';
import { Box, Button, Heading, Meter, TextInput} from 'grommet';
import { Add, Subtract, Share } from 'grommet-icons';
import PropTypes from 'prop-types';
import { defaultView, serverDateFormat, calendarDateDisplayFormat, calendarDayLabelFormat, payloadWithIDPropType, weeklyGoalPayloadPropType } from './configs';
import './App.css';

var moment = require('moment-timezone');

function isEmptyObject(obj) {
	return Object.entries(obj).length === 0 && obj.constructor === Object;
}

class Calendar extends React.Component {
	static propTypes = {
		currentMonth: PropTypes.shape({
			"month": PropTypes.string,
			"startingDayOfWeek": PropTypes.oneOf([0, 1, 2, 3, 4, 5, 6]),
			"totalDays": PropTypes.oneOf([28, 29, 30, 31]),
		}).isRequired,
		decrementMonthHandler: PropTypes.func.isRequired,
		incrementMonthHandler: PropTypes.func.isRequired,
		addNewWorkoutHandler: PropTypes.func.isRequired,
		workouts: PropTypes.objectOf(
			PropTypes.arrayOf(payloadWithIDPropType)
		).isRequired,
		deadline: PropTypes.string,
		defaultView: PropTypes.oneOf(Object.values(defaultView)),
		startingDayOfWeek: PropTypes.oneOf([0, 1, 2, 3, 4, 5, 6]).isRequired,
		mainTimezone: PropTypes.string,
		weeklyGoals: PropTypes.objectOf(
			weeklyGoalPayloadPropType
		).isRequired,
		sendWeeklyGoalsToDBHandler: PropTypes.func.isRequired,
		autofillWeeklyGoalHandler: PropTypes.func,
	};

	fillDayArray() {
		let firstDisplayedDay;
		let totalDisplayedDays;
		let fullArrayLength;
		let month;
		const startingDayOfWeek = this.props.startingDayOfWeek;

		if (this.props.defaultView === defaultView.CALENDAR) {
			month = this.props.currentMonth.month;
			const startOfMonth = this.props.currentMonth.startingDayOfWeek;
			const daysToStartOfWeek = startingDayOfWeek <= startOfMonth
				? startOfMonth - startingDayOfWeek
				: (7 - startingDayOfWeek) + startOfMonth;
			firstDisplayedDay = daysToStartOfWeek;
			totalDisplayedDays = this.props.currentMonth.totalDays;
		} else {
			month = moment().format(serverDateFormat);
			// This was Victor's version of the below, where A is the start of week and B is "today": abs(min((B-(A-7))*sgn(B-A), abs(B-A))
			const today = Number(moment().format("d"));
			const daysToStartOfWeek = startingDayOfWeek <= today
				? today - startingDayOfWeek
				: (7 - startingDayOfWeek) + today;

			firstDisplayedDay = daysToStartOfWeek;
			const deadlineObj = moment(this.props.deadline);
			totalDisplayedDays = Math.ceil(moment.duration(deadlineObj.diff(moment())).asDays()) + 1; // + 1 b/c we want to include the deadline day, 
		}

		fullArrayLength = firstDisplayedDay + totalDisplayedDays; // Account for padding in the beginning
		fullArrayLength = fullArrayLength + (fullArrayLength % 7 === 0 ? 0 : 7 - fullArrayLength % 7); // Pad extra days at the end
		let dayArray = Array(fullArrayLength).fill({});

		const currentDay = moment(month); // Prefill with given month since calendar doesn't necessarily reflect the current month.

		for (let i = firstDisplayedDay; i < firstDisplayedDay + totalDisplayedDays; i++) {
			const date = currentDay.format(serverDateFormat);
			const payloads = typeof this.props.workouts[date] !== 'undefined' ? this.props.workouts[date] : null;
			dayArray.splice(i, 1, {
				date: date,
				payloads: payloads,
			});

			currentDay.add(1, "day");
		}

		return dayArray;
	}

	generateHeaderDayLabels() {
		let daysOfWeek = [];
		
		for (let i = 0; i < 14; i++) {
			// Order: Sun --> Sat
			daysOfWeek.push(moment().day(i % 7).format(calendarDayLabelFormat));
		}
		daysOfWeek = daysOfWeek.slice(this.props.startingDayOfWeek, this.props.startingDayOfWeek + 7);

		const dayLabels = [<Box fill='horizontal'></Box>]; // Prefill with spacer on left for goals
		// Leave space for the goal module on the left
		dayLabels.push(...daysOfWeek.map((value, index) => {
			return (<Box align='center' fill='horizontal'><Heading level={5}>{value}</Heading></Box>);
		}));

		return (
			<Box direction='row'>
				{dayLabels}
			</Box>
		);
	}

	render() {
		// Split days into weeks
		const dayArray = this.fillDayArray();
		const weeks = [];

		for (let i = 0; i < dayArray.length; i += 7) {
			weeks.push(dayArray.slice(i, i + 7));
		}

		const weekElements = weeks.map((days, index) => {
			// Pre-fill a goal with the week data so the only thing the WeeklyGoalControl 
			// needs is the actual goal value.

			// Since the start/endOfWeek dates are used to query for workouts, they need to
			// include hour/minute info to account for workout start times.
			const startOfWeek = moment.tz(days[0].date, this.props.mainTimezone);
			startOfWeek.hour(0);
			startOfWeek.minute(0);
			const formattedStartOfWeek = moment(startOfWeek).format(serverDateFormat);

			const endOfWeek = moment.tz(days[days.length - 1].date, this.props.mainTimezone);
			endOfWeek.hour(23);
			endOfWeek.minute(59);

			const thisWeekGoal = formattedStartOfWeek in this.props.weeklyGoals
				? this.props.weeklyGoals[formattedStartOfWeek]
				: {
					payload: {
						startDate: startOfWeek.toISOString(),
						endDate: endOfWeek.toISOString(),
						goalType: "weekly_milage_goal",
					},
				};

			return (
				<WeekDisplay
					days={days}
					addNewWorkoutHandler={(date, id) => this.props.addNewWorkoutHandler(date, id)}
					goal={thisWeekGoal}
					sendWeeklyGoalsToDBHandler={newGoals => this.props.sendWeeklyGoalsToDBHandler(newGoals)}
					autofillWeeklyGoalHandler={goalID => this.props.autofillWeeklyGoalHandler(goalID)}
				/>
			);
		});

		return (
			<Box height='100vh'>
				{this.props.defaultView === defaultView.CALENDAR ?
					<CalendarMonthControl
						currentMonth={this.props.currentMonth}
						decrementMonthHandler={() => this.props.decrementMonthHandler()}
						incrementMonthHandler={() => this.props.incrementMonthHandler()}
					/>
					: null
				}
				{this.generateHeaderDayLabels()}
				<Box fill={true}>
					{weekElements}
				</Box>
			</Box>	
		);
	}
}

class CalendarMonthControl extends React.Component {
	static propTypes = {
		currentMonth: PropTypes.shape({
			"month": PropTypes.string,
			"startingDayOfWeek": PropTypes.oneOf([0, 1, 2, 3, 4, 5, 6]),
			"totalDays": PropTypes.oneOf([28, 29, 30, 31]),
		}).isRequired,
		decrementMonthHandler: PropTypes.func.isRequired,
		incrementMonthHandler: PropTypes.func.isRequired,
	};

	render() {
		return (
			<Box direction='row'>
				<h1>{moment(this.props.currentMonth.month).format("MMMM YYYY")}</h1>
				<Button onClick={() => this.props.decrementMonthHandler()} primary icon={<Subtract />}/>
				<Button onClick={() => this.props.incrementMonthHandler()} primary icon={<Add />}/>
			</Box>
		);
	}
}

class WeekDisplay extends React.Component {
	static propTypes = {
		days: PropTypes.arrayOf(
			PropTypes.shape({
				date: PropTypes.string,
				payloads: PropTypes.arrayOf(payloadWithIDPropType),
			})
		).isRequired,
		addNewWorkoutHandler: PropTypes.func.isRequired,
		goal: weeklyGoalPayloadPropType.isRequired,
		sendWeeklyGoalsToDBHandler: PropTypes.func.isRequired,
		autofillWeeklyGoalHandler: PropTypes.func,
	};

	computeWeekTotalMilage() {
		return(
			this.props.days.reduce((weekTotal, day) => {
				const dayTotal =  day.payloads
					? day.payloads.reduce((total, cur) => {
						const dayMilage = cur.payload.milage.actual
							? cur.payload.milage.actual
							: cur.payload.milage.goal;
		
						return (total + dayMilage);
					},0)
					: 0;

				return (weekTotal + dayTotal);
			}, 0)
		);
	}

	render() {
		const days = this.props.days.slice()
		const dayCells = [];

		// Goal Controls are placed on the left of the calendar
		dayCells.push(
			<WeekGoalControl
				key={this.props.goal.payload.startDate}
				goal={this.props.goal}
				totalMilage={this.computeWeekTotalMilage()}
				sendWeeklyGoalsToDBHandler={newGoals => this.props.sendWeeklyGoalsToDBHandler(newGoals)}
				autofillWeeklyGoalHandler={goalID => this.props.autofillWeeklyGoalHandler(goalID)}
			/>
		);
		dayCells.push(...days.map((value, index) => {
			if (isEmptyObject(value)) {
				// Still have to return a div to keep flexbox spacing correct for the whole week.
				return (<Box
					border={true}
					width='100%'
					pad='xsmall'
				></Box>);
			}
			return (
				<DayCell
					// From the react gods on github: 
					// An input should be either uncontrolled (value always undef/null) or controlled (value is a string, so it should be an empty string rather than null) for its entire lifetime.
					// This solves the problem of elements not refreshing when their value changes from non-null/non-undef to null/undef.
					date={value ? value.date : ''}
					payloads={value.payloads 
						? value.payloads 
						: [{ payload: { 'content': '', 'type': '', 'date': '', milage: {goal: 0} }, id: '' }]}
					// updateDayContentFunc={(date, content) => this.props.updateDayContentFunc(date, content)}
					addNewWorkoutHandler={(date, id) => this.props.addNewWorkoutHandler(date, id)}
				/>
			);
		}));

		return (
			<Box direction='row' fill={true}>
				{dayCells}
			</Box>
		);
	}
}

class WeekGoalControl extends React.Component {
	static propTypes = {
		goal: weeklyGoalPayloadPropType,
		totalMilage: PropTypes.number,
		sendWeeklyGoalsToDBHandler: PropTypes.func.isRequired,
		autofillWeeklyGoalHandler: PropTypes.func,
	}

	constructor(props) {
		super(props);

		this.state = {
			showEditGoal: false,
		}
	}

	handleGoalChange(newValue) {
		const newGoal = { ...this.props.goal }
		newGoal.payload.goalValue = newValue;
		this.props.sendWeeklyGoalsToDBHandler([newGoal]);
	}

	render() {
		const goalDisplay = 
			<Box
				width='100%'
				border={true}
				pad='xsmall'
				justify='center'
				align='center'
				onClick={() => this.setState({showEditGoal: true})}
				focusIndicator={false}
			>
				<div style={{position: 'absolute', cursor: 'pointer'}}>
					<Meter
						type='circle'
						thickness='small'
						size='xsmall'
						alignSelf='center'
						round
						max={this.props.goal.payload.goalValue}
						values={[{value: this.props.totalMilage,}]}
					/>
				</div>

				<div
					style={{
						position: 'absolute',
						textAlign: 'center',
						zIndex: -1,
					}}
				>
					<h2>
						{this.props.totalMilage}
						<br/>
						{this.props.goal.payload.goalValue ? this.props.goal.payload.goalValue : '--'}
					</h2>
				</div>
				
				<Box alignSelf='end' margin={{top: 'auto'}}>
					<Button 
						onClick={(event) => {
							// This stops the container div from registering a click when the button is clicked
							if (event.stopPropagation) {
								event.stopPropagation();
							}
							this.props.autofillWeeklyGoalHandler(this.props.goal.goalID)
						}}
						icon={<Share size='small'/>}
						primary
					/>
				</Box>
			</Box>;
		
		const editDisplay = 
			<Box
				width='100%'
				border={true}
				pad='xsmall'
				justify='center'
				align='start'
			>
				<TextInput
					placeholder='Week Milage Goal'
					value={this.props.goal.payload.goalValue}
					onChange={(e) => {
						this.handleGoalChange(Number(e.target.value))
					}}
				/>
				<Button
					onClick={() => {this.setState({showEditGoal: false})}}
					margin={{top: 'small'}}
					label='Close'
				/>
			</Box>
	
		if (this.state.showEditGoal) {
			return (editDisplay);
		} else {
			return (goalDisplay);
		}
	}
}

class DayCell extends React.Component {
	static propTypes = {
		addNewWorkoutHandler: PropTypes.func.isRequired,
		date: PropTypes.string.isRequired,
		payloads: PropTypes.arrayOf(payloadWithIDPropType).isRequired,
	};

	constructor(props) {
		super(props);

		this.state = {
			showAddButton: false,
		};
	}

	generateDisplayDate() {
		if (this.props.date === "") {
			return (null);
		}
		return moment(this.props.date).format(calendarDateDisplayFormat);
	}

	render() {
		const content = [];
		if (this.props.payloads[0].id !== "") {
			this.props.payloads.forEach((workout) => {

				const label = workout.payload.milage.goal !== 0
					? workout.payload.milage.goal + ' miles'
					: 'Run';

				content.push(
					<Button
						key={workout.id}
						onClick={() => this.props.addNewWorkoutHandler(workout.payload.startDate, workout.id)}
						label={label}
						margin={{bottom: 'xsmall'}}
					/>
				);
			});
		}

		return (
			<Box
				border={true}
				direction='column'
				width='100%'
				pad='xsmall'
				alignContent='start'
				algin='start'
				overflow='scroll'
				onMouseEnter={() => {this.setState({showAddButton: true})}}
				onMouseLeave={() => {this.setState({showAddButton: false})}}
			>
				<Heading 
					level={3}
					size='small'
					margin='none'
				>
					{this.generateDisplayDate()}
				</Heading>
				{content}
				{
					this.state.showAddButton 
					? 
						// margin.top = auto is so the button sticks to the bottom
						<Box alignSelf='start' margin={{top: 'auto'}}>
							<Button
								onClick={() => this.props.addNewWorkoutHandler(this.props.date, "")}
								primary
								icon={<Add />}
							/>
						</Box>
					: null
				}
				
			</Box>
		);
	}
}

export default Calendar;
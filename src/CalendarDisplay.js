import React from 'react';
import { Box, Button, Heading, Meter, TextInput} from 'grommet';
import { Add, Subtract, Share } from 'grommet-icons';
import PropTypes from 'prop-types';
import Loader from 'react-loader-spinner';
import { 
	defaultView, 
	serverDateFormat, 
	calendarDateDisplayFormat, 
	calendarDayLabelFormat, 
	payloadWithIDPropType, 
	weeklyGoalPayloadPropType,
	creationTypes,
	goalControlColor,
	getNumberOfDaysInMonth,
	brandColor,
	loaderTimeout,
	dark1,
	dark2,
	light,
} from './configs';
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
		resetToCurrentMonthHandler: PropTypes.func.isRequired,
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
		selectedWorkoutID: PropTypes.string.isRequired,
	};

	getPayloadsForDate(date) {
		return (typeof this.props.workouts[date] !== 'undefined' ? this.props.workouts[date] : null);
	}

	// fillDayArray populates the month, but we want to the show the
	// days on the edge (beginning and end) of the abutting months as well.
	generateEdgeDays(firstDisplayedDay, fullArrayLength) {
		const numDaysAtBeginning = firstDisplayedDay;
		const numDaysAtEnd = fullArrayLength - numDaysAtBeginning - this.props.currentMonth.totalDays;

		const prevMonthCursor = moment(this.props.currentMonth.month).subtract(1, 'month');
		prevMonthCursor.date(
			getNumberOfDaysInMonth(prevMonthCursor.month(), prevMonthCursor.year()) - numDaysAtBeginning + 1
		);
		const nextMonthCursor = 
			moment(this.props.currentMonth.month)
			.add(1, 'month')
			.date(1);

		const prevMonthDayCells = [];
		const nextMonthDayCells = [];

		for (let i = 0; i < numDaysAtBeginning; i++) {
			const date = prevMonthCursor.format(serverDateFormat);
			const payloads = this.getPayloadsForDate(date);

			prevMonthDayCells.push({
				date: date,
				payloads: payloads,
			});

			prevMonthCursor.add(1, 'day');
		}

		for (let j = 0; j < numDaysAtEnd; j++) {
			const date = nextMonthCursor.format(serverDateFormat);
			const payloads = this.getPayloadsForDate(date);

			nextMonthDayCells.push({
				date: date,
				payloads: payloads,
			});

			nextMonthCursor.add(1, 'day');
		}

		return({
			prevMonthDayCells: prevMonthDayCells,
			nextMonthDayCells: nextMonthDayCells,
		});
	}

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
		let dayArray = [];

		const currentDay = moment(month); // Prefill with given month since calendar doesn't necessarily reflect the current month.

		for (let i = firstDisplayedDay; i < firstDisplayedDay + totalDisplayedDays; i++) {
			const date = currentDay.format(serverDateFormat);
			const payloads = this.getPayloadsForDate(date);
			dayArray.splice(i, 1, {
				date: date,
				payloads: payloads,
			});

			currentDay.add(1, "day");
		}

		const edges = this.generateEdgeDays(firstDisplayedDay, fullArrayLength);
		dayArray = (edges.prevMonthDayCells.concat(dayArray)).concat(edges.nextMonthDayCells);

		return dayArray;
	}

	generateHeaderDayLabels() {
		let daysOfWeek = [];
		
		for (let i = 0; i < 14; i++) {
			// Order: Sun --> Sat
			daysOfWeek.push(moment().day(i % 7).format(calendarDayLabelFormat));
		}
		daysOfWeek = daysOfWeek.slice(this.props.startingDayOfWeek, this.props.startingDayOfWeek + 7);

		const dayLabels = [<Box fill='horizontal'key={-1}></Box>]; // Prefill with spacer on left for goals
		// Leave space for the goal module on the left
		dayLabels.push(...daysOfWeek.map((value, index) => {
			return (
				<Box 
					align='center'
					fill='horizontal'
					key={index}
				>
					<Heading level={5} size='small' margin={{bottom: 'xsmall', top: 'none'}}>{value}</Heading>
				</Box>
			);
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
						goalType: "weekly_mileage_goal",
					},
				};

			return (
				<WeekDisplay
					days={days}
					addNewWorkoutHandler={(date, id, callback) => this.props.addNewWorkoutHandler(date, id, callback)}
					goal={thisWeekGoal}
					sendWeeklyGoalsToDBHandler={newGoals => this.props.sendWeeklyGoalsToDBHandler(newGoals)}
					autofillWeeklyGoalHandler={(goalID, callback) => this.props.autofillWeeklyGoalHandler(goalID, callback)}
					key={index}
					mainMonth={this.props.currentMonth.month}
					selectedWorkoutID={this.props.selectedWorkoutID}
				/>
			);
		});

		return (
			<Box height='100vh' background={light} key={this.props.currentMonth.month}>
				<Box gridArea='calendarControl' margin={{left: 'medium'}}>
					{this.props.defaultView === defaultView.CALENDAR ?
						<CalendarMonthControl
							currentMonth={this.props.currentMonth}
							decrementMonthHandler={() => this.props.decrementMonthHandler()}
							incrementMonthHandler={() => this.props.incrementMonthHandler()}
							resetToCurrentMonthHandler={() => this.props.resetToCurrentMonthHandler()}
						/>
						: null
				}
				</Box>
				
				{this.generateHeaderDayLabels()}
				<Box 
					gridArea='calendar'
					fill={true}
				>
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
		resetToCurrentMonthHandler: PropTypes.func.isRequired,
	};

	render() {
		return (
			<Box 
				direction='row'
				align='center'
				gap='xsmall'
				pad={{top: 'small'}}
			>
				<Box elevation='medium' round='small'>
					<Button onClick={() => this.props.decrementMonthHandler()} icon={<Subtract size='small'/>}/>
				</Box>
				<Box elevation='medium' round='small'>
					<Button onClick={() => this.props.incrementMonthHandler()} icon={<Add size='small'/>}/>
				</Box>
				<Heading 
					level={3}
					size='small'
					onClick={() => this.props.resetToCurrentMonthHandler()}
					style={{cursor: 'grab'}}
					margin='none'
				>
					{moment(this.props.currentMonth.month).format("MMMM YYYY")}
				</Heading>
				
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
		mainMonth: PropTypes.string,
		selectedWorkoutID: PropTypes.string.isRequired,
	};

	computeWeekTotalmileage() {
		return(
			this.props.days.reduce((weekTotal, day) => {
				const dayTotal =  day.payloads
					? day.payloads.reduce((total, cur) => {
						const daymileage = cur.payload.mileage.actual
							? cur.payload.mileage.actual
							: cur.payload.mileage.goal;
		
						return (total + daymileage);
					},0)
					: 0;

				return (weekTotal + dayTotal);
			}, 0)
		);
	}

	isThisWeek() {
		return (
			moment().isSameOrAfter(this.props.days[0].date, 'day') 
			&& moment().isSameOrBefore(this.props.days[this.props.days.length - 1].date, 'day')
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
				totalmileage={this.computeWeekTotalmileage()}
				sendWeeklyGoalsToDBHandler={newGoals => this.props.sendWeeklyGoalsToDBHandler(newGoals)}
				autofillWeeklyGoalHandler={(goalID, callback) => this.props.autofillWeeklyGoalHandler(goalID, callback)}
			/>
		);
		dayCells.push(...days.map((value, index) => {
			if (isEmptyObject(value)) {
				// Boxes for days that are not in this month
				return (<Box
					width='100%'
					pad='xsmall'
					background='black'
					key={index}
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
						: [{ payload: { 'content': '', 'type': '', 'date': '', mileage: {goal: 0} }, id: '' }]}
					// updateDayContentFunc={(date, content) => this.props.updateDayContentFunc(date, content)}
					addNewWorkoutHandler={(date, id, callback) => this.props.addNewWorkoutHandler(date, id, callback)}
					isThisWeek={this.isThisWeek()}
					key={index}
					mainMonth={this.props.mainMonth}
					selectedWorkoutID={this.props.selectedWorkoutID}
				/>
			);
		}));

		const border = !this.isThisWeek()
			? false
			: {
				side: 'horizontal',
				style: 'solid',
				size: 'medium',
				color: dark1,
			}

		return (
			<Box 
				direction='row' 
				fill={true}
				border={border}
			>
				{dayCells}
			</Box>
		);
	}
}

class WeekGoalControl extends React.Component {
	static propTypes = {
		goal: weeklyGoalPayloadPropType,
		totalmileage: PropTypes.number,
		sendWeeklyGoalsToDBHandler: PropTypes.func.isRequired,
		autofillWeeklyGoalHandler: PropTypes.func,
	}

	constructor(props) {
		super(props);

		this.state = {
			showEditGoal: false,
			loadingState: false,
		};
	}

	doesGoalExist() {
		return ('goalID' in this.props.goal);
	}

	handleGoalChange(newValue) {
		const newGoal = { ...this.props.goal }
		newGoal.payload.goalValue = newValue;
		this.props.sendWeeklyGoalsToDBHandler([newGoal]);
	}

	render() {
		const backgroundColor = light;
		const autofillButton = 
			<Box 
				alignSelf='end' 
				margin={{top: 'auto'}}
			>
				<Button 
					onClick={(event) => {
						// This stops the container div from registering a click when the button is clicked
						if (event.stopPropagation) {
							event.stopPropagation();
						}
						this.setState({loadingState: true});
						this.props.autofillWeeklyGoalHandler(this.props.goal.goalID, (success) => {
							if (success) {
								this.setState({loadingState: false});
							}
						})
						
					}}
					icon={<Share size='small'/>}
					primary
					color={goalControlColor}
				/>
			</Box>;

		const goalDisplay = 
			<Box
				style={{
					borderTop: '1px solid black',
					borderRight: '1px solid black',
				}}
				width='100%'
				pad='xsmall'
				justify='center'
				align='center'
				background={backgroundColor}
				onClick={() => this.setState({showEditGoal: true})}
				focusIndicator={false}
			>
				<div style={{position: 'absolute', cursor: 'pointer'}}>
					<Meter
						type='circle'
						thickness='small'
						size='xsmall'
						alignSelf='center'
						background={dark2}
						round
						max={this.props.goal.payload.goalValue}
						values={[{
							value: this.props.totalmileage,
							color: goalControlColor,
						}]}
						zIndex={1}
					/>
				</div>

				<div
					style={{
						position: 'absolute',
						textAlign: 'center',
					}}
				>
					<h2>
						{this.props.totalmileage}
						<br/>
						{this.props.goal.payload.goalValue ? this.props.goal.payload.goalValue : '--'}
					</h2>
				</div>
				
				{this.doesGoalExist() ? autofillButton : null}
			</Box>;
		
		const editDisplay = 
			<Box
				width='100%'
				pad='xsmall'
				justify='center'
				align='start'
				background={backgroundColor}
				style={{
					borderTop: '1px solid black',
					borderRight: '1px solid black',
				}}
			>
				<TextInput
					placeholder='Mileage Goal'
					value={this.doesGoalExist() ? this.props.goal.payload.goalValue: ''}
					onChange={(e) => {
						this.handleGoalChange(Number(e.target.value));
					}}
				/>
				<Button
					onClick={() => {this.setState({showEditGoal: false})}}
					margin={{top: 'small'}}
					color={goalControlColor}
					label='Close'
				/>
			</Box>

		const loader = 
			<Box
				width='100%'
				pad='xsmall'
				justify='center'
				align='center'
				background={backgroundColor}
				style={{
					borderTop: '1px solid black',
					borderRight: '1px solid black',
				}}
			>
				<Loader
					type="BallTriangle"
					color={goalControlColor}
					timeout={loaderTimeout}
				 />
			</Box>;
		
		if (this.state.loadingState) {
			return (loader);
		} else if (this.state.showEditGoal) {
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
		isThisWeek: PropTypes.bool.isRequired,
		mainMonth: PropTypes.string.isRequired,
		selectedWorkoutID: PropTypes.string.isRequired,
	};

	constructor(props) {
		super(props);

		this.state = {
			showAddButton: false,
			loadingState: false,
		};
	}

	generateDisplayDate() {
		if (this.props.date === "") {
			return (null);
		}
		return (moment(this.props.date).format(calendarDateDisplayFormat));
	}

	isToday() {
		// if (!this.props.isThisWeek) {
		// 	return (false);
		// }
		return (moment().isSame(this.props.date, 'day'));
	}

	isMainMonth() {
		return (moment(this.props.date).isSame(this.props.mainMonth, 'month'));
	}

	render() {
		const content = [];
		if (this.props.payloads[0].id !== "") {
			this.props.payloads.forEach((workout) => {

				const label = workout.payload.mileage.goal !== 0
					? workout.payload.mileage.goal + ' mi.'
					: 'Run';

				const borderColor = workout.id === this.props.selectedWorkoutID
					? brandColor
					: light

				content.push(
					<Box 
						elevation='large'
						key={workout.id}
						onClick={() => this.props.addNewWorkoutHandler(workout.payload.startDate, workout.id)}
						style={{
							color: workout.payload.creationType === creationTypes.OWNER ? 'brand' : goalControlColor,
							fontWeight: 'bold',
							fontSize: '1.4em',
						}}
						pad='xsmall'
						round='xsmall'
						background={light}
						border={{
							size: 'medium',
							style: 'solid',
							side: 'all',
							color: borderColor,
						}}
					>
					{label}
					</Box>
				);
			});
		}

		// temp for highlighting week/day
		let background = light;
		if (this.isToday()) {
			background = brandColor;
		} else if (this.props.isThisWeek) {
			background = light;
		} else if (!this.isMainMonth()) {
			background = dark2;
		}

		const addButton = 
			// margin.top = auto is so the button sticks to the bottom
			<Box alignSelf='start' margin={{top: 'auto'}}>
				{this.state.loadingState
				? 
					<Loader
						type="ThreeDots"
						color={brandColor}
						timeout={loaderTimeout}
						height="100%"
					/>
				:
					<Box 
						elevation='medium'
						round='medium'
						onClick={() => {
							this.setState({loadingState: true});
							this.props.addNewWorkoutHandler(this.props.date, "", (isSuccess) => {
								this.setState({loadingState: false});
							});
						}}
					>
					<Button
						primary
						color={dark1}
						icon={<Add size='small'/>}
					/>
					</Box>
				}
			</Box>;

		return (
			<Box
				style={{
					borderTop: '1px solid ' + dark1,
					borderRight: '1px solid ' + dark1,
				}}
				direction='column'
				width='100%'
				pad='xsmall'
				alignContent='start'
				algin='start'
				overflow='scroll'
				onMouseEnter={() => {this.setState({showAddButton: true})}}
				onMouseLeave={() => {this.setState({showAddButton: false})}}
				background={background}
			>
				<Heading 
					level={3}
					size='xsmall'
					margin='xsmall'
				>
					{this.generateDisplayDate()}
				</Heading>
				<Box
					direction='column'
					gap='xsmall'
				>
					{content}
				</Box>
				{ (this.state.showAddButton || this.state.loadingState) ? addButton : null}
			</Box>
		);
	}
}

export default Calendar;
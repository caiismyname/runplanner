import React from 'react';
import { Box, Grommet, Button} from 'grommet';
import PropTypes from 'prop-types';
import { defaultView, serverDateFormat, dateDisplayFormat, payloadWithIDPropType, weeklyGoalPayloadPropType } from './configs';
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
		let dayFormatting = "ddd"; // ddd = Mon | dddd = Monday 
		for (let i = 0; i < 14; i++) {
			// Order: Sun --> Sat
			daysOfWeek.push(moment().day(i % 7).format(dayFormatting));
		}
		daysOfWeek = daysOfWeek.slice(this.props.startingDayOfWeek, this.props.startingDayOfWeek + 7);

		const dayLabels = daysOfWeek.map((value, index) => {
			return (<div key={value} style={{width: '100%'}}><h1>{value}</h1></div>);
		});

		// For the goal module
		dayLabels.push(<div style={{width: '100%'}}></div>);

		return dayLabels;
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
				<div key={index.toString()}>
					<WeekDisplay
						days={days}
						addNewWorkoutHandler={(date, id) => this.props.addNewWorkoutHandler(date, id)}
						goal={thisWeekGoal}
						sendWeeklyGoalsToDBHandler={newGoals => this.props.sendWeeklyGoalsToDBHandler(newGoals)}
						autofillWeeklyGoalHandler={goalID => this.props.autofillWeeklyGoalHandler(goalID)}
					/>
				</div>
			);
		});

		return (
			<div>
				{this.props.defaultView === defaultView.CALENDAR ?
					<CalendarMonthControl
						currentMonth={this.props.currentMonth}
						decrementMonthHandler={() => this.props.decrementMonthHandler()}
						incrementMonthHandler={() => this.props.incrementMonthHandler()}
					/>
					: null
				}
				<Box 
					direction='row'
				>
					{this.generateHeaderDayLabels()}
				</Box>
				{weekElements}
			</div>
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
			<div>
				<h1>{moment(this.props.currentMonth.month).format("MMMM YYYY")}</h1>
				<div>
					<Button onClick={() => this.props.decrementMonthHandler()} label='<'/>
					<Button onClick={() => this.props.incrementMonthHandler()} label='>'/>
				</div>
			</div>
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

	render() {
		const days = this.props.days.slice()
		const dayCells = days.map((value, index) => {
			if (isEmptyObject(value)) {
				// Still have to return a div to keep flexbox spacing correct for the whole week.
				return <div className="dayCell" key={index}></div>;
			}
			return (
				<div className="dayCell" key={index}>
					<DayCell
						// From the react gods on github: 
						// An input should be either uncontrolled (value always undef/null) or controlled (value is a string, so it should be an empty string rather than null) for its entire lifetime.
						// This solves the problem of elements not refreshing when their value changes from non-null/non-undef to null/undef.
						date={value ? value.date : ""}
						payloads={value.payloads ? value.payloads : [{ payload: { "content": "", "type": "", "date": "" }, id: "" }]}
						// updateDayContentFunc={(date, content) => this.props.updateDayContentFunc(date, content)}
						addNewWorkoutHandler={(date, id) => this.props.addNewWorkoutHandler(date, id)}
					/>
				</div>
			);
		});

		dayCells.push(
			<WeekGoalControl
				key={this.props.goal.payload.startDate}
				goal={this.props.goal}
				sendWeeklyGoalsToDBHandler={newGoals => this.props.sendWeeklyGoalsToDBHandler(newGoals)}
				autofillWeeklyGoalHandler={goalID => this.props.autofillWeeklyGoalHandler(goalID)}
			/>
		);

		return (
			<Box direction='row'>
				{dayCells}
			</Box>
		);
	}
}

class WeekGoalControl extends React.Component {
	static propTypes = {
		goal: weeklyGoalPayloadPropType,
		sendWeeklyGoalsToDBHandler: PropTypes.func.isRequired,
		autofillWeeklyGoalHandler: PropTypes.func,
	}

	handleGoalChange(newValue) {
		const newGoal = { ...this.props.goal }
		newGoal.payload.goalValue = newValue;
		this.props.sendWeeklyGoalsToDBHandler([newGoal]);
	}

	render() {
		if ("goalID" in this.props.goal) { // This week has a goal
			return (
				<div>
					<input
						type="number"
						value={this.props.goal.payload.goalValue}
						onChange={(e) => this.handleGoalChange(Number(e.target.value))}
					/>
					miles
					<button onClick={() => this.props.autofillWeeklyGoalHandler(this.props.goal.goalID)}> Autofill</button>
				</div>
			);
		} else { // This week doesn't have a goal
			return (
				<div>
					<h2>No goal set</h2>
					<button
						onClick={() => {
							const newGoal = { ...this.props.goal }
							newGoal.payload.goalValue = 40;
							this.props.sendWeeklyGoalsToDBHandler([newGoal]);
						}}
					>
						Set Goal
					</button>
				</div>
			);
		}
	}
}

class DayCell extends React.Component {
	static propTypes = {
		addNewWorkoutHandler: PropTypes.func.isRequired,
		date: PropTypes.string.isRequired,
		payloads: PropTypes.arrayOf(payloadWithIDPropType).isRequired,
	};

	generateDisplayDate() {
		if (this.props.date === "") {
			return (null);
		}
		return moment(this.props.date).format(dateDisplayFormat);
	}

	render() {
		const content = [];
		if (this.props.payloads[0].id !== "") {
			// if (this.props.payloads.length > 0) {
			this.props.payloads.forEach((workout) => {
				content.push(
					<div
						key={workout.id}
						style={{ border: "1px solid green" }}
						onClick={() => this.props.addNewWorkoutHandler(workout.payload.startDate, workout.id)}
					>
						<h3>{workout.payload.type}</h3>
						<p>{workout.payload.content}</p>
						{workout.payload.milage.goal !== 0
							? <p>{workout.payload.milage.goal + " miles"}</p>
							: null
						}
					</div>
				);
			});
		}

		const plusButton = (
			<button
				style={{ width: "34%", margin: "auto", display: "block", border: "2px solid red" }}
				onClick={() => this.props.addNewWorkoutHandler(this.props.date, "")}
			>
				<h1>+</h1>
			</button>
		);

		return (
			<div>
				<h2>{this.generateDisplayDate()}</h2>
				{content}
				{plusButton}
			</div>
		);
	}
}

export default Calendar;
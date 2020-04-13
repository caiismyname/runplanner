import React from 'react';
import './App.css';
import { BrowserRouter as Router, Route } from 'react-router-dom';
import axios from 'axios';

import { defaultView, serverDateFormat, dbAddress, gClientID, gCalAPIKey, gCalDefaultName, creationTypes } from './configs';
import LoginPage from "./LoginPage";
import NewUserOnboarding from "./NewUserOnboarding";
import EditWorkoutModule from "./EditWorkoutModule";
import Calendar from "./CalendarDisplay";

var moment = require('moment-timezone');

class MonthHandler {
	// Defaults to current month if none is given
	constructor(now = moment()) {
		this.currentMonth = now; // MomentJS's months are 0 indexed
	}

	getFormattedMonth() {
		return this.currentMonth.format("YYYY-MM");
	}

	getNumberOfDaysInMonth(month, year) {
		// Source: https://www.geeksforgeeks.org/how-to-get-the-number-of-days-in-a-specified-month-using-javascript/
		return new Date(year, month, 0).getDate();
	}

	startingDayOfWeek(month, year) {
		return new Date(month + "-01-" + year).getDay(); // Fucking American date formatting, not ISO
	}

	getMonthInfo() {
		const now = this.currentMonth; // Moment's months are 0 indexed (0 is January)
		return ({
			totalDays: this.getNumberOfDaysInMonth(now.month() + 1, now.year()),
			startingDayOfWeek: this.startingDayOfWeek(now.month() + 1, now.year()), // 0 is Sunday
			month: now.format("YYYY-MM"),
		});
	}

	getMonthStart() {
		return this.getMonthInfo().month + "-1";
	}

	getMonthEnd() {
		const monthInfo = this.getMonthInfo();
		return monthInfo.month + "-" + monthInfo.totalDays;
	}

	incrementMonth() {
		return new MonthHandler(this.currentMonth.add(1, "month"));
	}

	decrementMonth() {
		return new MonthHandler(this.currentMonth.subtract(1, "month"));
	}
}

class WorkoutHandler {
	// Initialize to empty since MainPanel won't have pulled from DB yet when WorkoutHandler is constructed.
	constructor(userID = "", calendarID = "", mainTimezone = "", defaultStartTime = { hour: 7, minute: 0 }, defaultRunDuration = 60) {
		this.userID = userID;
		this.calendarID = calendarID;
		this.workouts = {}; // Key = MongoId, Value = workout details
		this.dates = {}; // Key = date, Value = MongoId (to use as reference into above dict)
		this.modified = [];
		this.mainTimezone = mainTimezone;
		this.defaultRunDuration = defaultRunDuration;
		this.defaultStartTime = defaultStartTime; // 24 hour time
	}

	setUserID(id) {
		this.userID = id;
	}

	setDefaultRunDuration(duration) {
		this.defaultRunDuration = duration;
	}

	setMainTimezone(timezone) {
		this.mainTimezone = timezone;
	}

	setCalendarID(id) {
		this.calendarID = id;
	}

	setDefaultStartTime(time) {
		this.defaultStartTime = time;
	}

	generateEmptyPayload(givenDate) {
		let date = moment(givenDate);
		date.hour(this.defaultStartTime.hour);
		date.minute(this.defaultStartTime.minute);
		date = moment.tz(date, this.mainTimezone);

		return ({
			startDate: date.toISOString(),
			content: "",
			type: "",
			milage: {
				goal: 0,
				// actual: 0,
			},
			creationType: creationTypes.OWNER,
		});
	}

	addEmptyWorkout(date, callback) {
		this.addWorkouts([this.generateEmptyPayload(date)], callback);
	}

	addWorkouts(payloads, callback) {
		const wrappedPayloads = payloads.map(payload => {
			const wrappedPayload = {
				payload: payload,
				owner: this.userID,
			};
			return (wrappedPayload);
		});

		// Send workout to Mongo
		axios.post(dbAddress + "addworkouts", { "toAdd": wrappedPayloads, "userID": this.userID })
			.then(res => {
				const newWorkoutIDs = [];

				// Once workout is confirmed in Mongo, add the workout to local state.
				res.data.workouts.forEach(workout => {
					const newWorkoutID = workout._id;
					newWorkoutIDs.push(newWorkoutID);
					this.workouts[newWorkoutID] = workout.payload;

					const date = moment(workout.payload.startDate).format(serverDateFormat);
					if (date in this.dates) {
						this.dates[date].push(newWorkoutID);
					} else {
						this.dates[date] = [newWorkoutID];
					};
				});

				callback(this.generateDisplayWorkouts(), newWorkoutIDs);
			});
	}

	// this function is deprecated in favor of server-side gcal event creation
	addGCalEvents(payloads, callback) {
		window.gapi.load('client:auth2', () => {
			window.gapi.client.load("calendar", "v3", () => {
				const batch = window.gapi.client.newBatch();
				payloads.forEach(payloadWrapper => {
					const payload = payloadWrapper.payload;
					batch.add(window.gapi.client.calendar.events.insert(
						{
							'calendarId': this.calendarID,
							'resource': {
								'summary': "New run",
								'start': {
									'dateTime': payload.startDate,
									'timeZone': this.timeZone
								},
								'end': {
									'dateTime': moment(payload.startDate).add(this.defaultRunDuration, "minutes").toISOString(),
									'timeZone': this.timeZone
								}
							}
						}
					));
				});

				// Google batch API says it'll return objects in the order they're sent
				batch.then(response => {
					const payloadsWithGEventID = [...payloads];
					let payloadIdx = 0;
					for (var eventIdx in response.result) {
						payloadsWithGEventID[payloadIdx].gEventID = response.result[eventIdx].result.id;
						payloadIdx += 1;
					}
					callback(payloadsWithGEventID);
				});
			});
		});
	}

	// no date changes for now TODO add date changes
	updateWorkout(id, payload, callback) {
		// This funciton does not push updates to DB, it just marks workouts that need to be pushed upon save.
		this.workouts[id] = payload;
		this.workouts[id].creationType = creationTypes.OWNER;
		// "Modified" workouts are workouts that have already been pushed to DB.
		if (!(this.modified.includes(id))) {
			this.modified.push(id);
		}
		callback(this.generateDisplayWorkouts());
	}

	// this function is deprecated in favor of server-side gcal event updates
	updateGCalEvents(workoutIDs) {
		window.gapi.load('client:auth2', () => {
			window.gapi.client.load("calendar", "v3", () => {
				const batch = window.gapi.client.newBatch();

				workoutIDs.forEach(workoutID => {
					const gEventID = this.gEventIDs[workoutID];
					// const newTitle = this.workouts[workoutID].content;
					const newTitle = this.workouts[workoutID].milage.goal + " mile run";
					const newStart = this.workouts[workoutID].startDate;

					batch.add(window.gapi.client.calendar.events.update(
						{
							'calendarId': this.calendarID,
							'eventId': gEventID,
							'resource': {
								'summary': newTitle,
								'start': {
									'dateTime': newStart,
									'timeZone': this.timeZone
								},
								'end': {
									'dateTime': moment(newStart).add(this.defaultRunDuration, "minutes").toISOString(),
									'timeZone': this.timeZone
								}
							}
						}
					));
				});

				batch.then(response => {
					console.log(response);
				});
			});
		});
	}

	deleteWorkouts(workoutIDs, callback) {
		axios.post(dbAddress + "deleteworkouts", { userID: this.userID, toDelete: workoutIDs })
			.then(res => {
				if (res) {
					res.data.deleted.forEach(deleted => {
						delete this.workouts[deleted.id];
						const formattedStartDate = moment(deleted.startDate).format(serverDateFormat);
						const toDeleteIdx = this.dates[formattedStartDate].indexOf(deleted.id);
						this.dates[formattedStartDate].splice(toDeleteIdx, 1);

						// Need to delete the list otherwise the Calendar won't know to generate 
						// empty prop for the DayCell
						if (this.dates[formattedStartDate].length === 0) {
							delete this.dates[formattedStartDate];
						}
					})

					callback(this.generateDisplayWorkouts());
				} else {
					console.log("Deleting failed");
				}
			})
	}

	syncToDB(callback) {
		// TODO do these still need to be deduped?
		const modified = [...new Set(this.modified)]; // Dedup the list
		const workoutsToUpdate = modified.map(workoutID => {
			return ({
				payload: this.workouts[workoutID],
				owner: this.userID,
				id: workoutID,
			});
		});

		if (workoutsToUpdate.length > 0) {
			axios.post(dbAddress + "updateworkouts", { "toUpdate": workoutsToUpdate, 'userID': this.userID })
				.then(res => {
					console.log(res.data);
					this.modified = [];

					// Replace modified local workouts with the server equivalent, for data synchronicity
					res.data.workouts.forEach(workout => {
						this.workouts[workout._id] = workout.payload;
					})
					callback(this.generateDisplayWorkouts());
				});
		};
	}

	pullWorkoutsFromDB(startDate, endDate, callback) {
		axios.get(dbAddress + "getworkoutsforownerfordaterange/"
			+ this.userID + "/"
			+ startDate + "/"
			+ endDate)
			.then(response => {
				console.log(response);
				if (response) {
					response.data.forEach(workout => {
						// Current choice is to always overwrite local info with DB info if conflict exists. 
						this.workouts[workout.id] = workout.payload;

						const formattedDate = moment(workout.payload.startDate).format(serverDateFormat);
						if (formattedDate in this.dates) {
							if (!this.dates[formattedDate].includes(workout.id)) {
								this.dates[formattedDate].push(workout.id);
							}
						} else {
							this.dates[formattedDate] = [workout.id];
						}
					});
					callback(this.generateDisplayWorkouts());
				}
			});
	}

	generateDisplayWorkouts() {
		let res = {};
		Object.keys(this.dates).forEach((date, idx) => {
			const workoutsOnDate = [];
			this.dates[date].forEach((workoutID) => {
				workoutsOnDate.push({ payload: this.workouts[workoutID], id: workoutID });
			});

			res[date] = workoutsOnDate;
		});

		return res;
	}

	getWorkoutById(id) {
		return this.workouts[id];
	}
}

class MainPanel extends React.Component {
	constructor(props) {
		super(props);

		// This has to come before this.state is set. I don't know why.
		this.toggleEditWorkoutModule = this.toggleEditWorkoutModule.bind(this);
		this.signinHandler = this.signinHandler.bind(this);
		this.authCodeHandler = this.authCodeHandler.bind(this);
		this.onboardingHandler = this.onboardingHandler.bind(this);

		this.state = {
			// local state control (not loaded from anywhere)
			pendingUserLoading: true,
			userIsLoaded: false, // Has the user logged in via Google OAuth?
			userExists: false, // Is the Google userID in our DB?
			newUserAuthCode: "", // Need to temporarily store new users' auth code for server-side access
			editWorkoutModuleConfig: {
				showingEditWorkoutModule: false,
				workoutID: "",
				workoutDate: "",
			},
			currentMonth: new MonthHandler(),
			workoutHandler: new WorkoutHandler(),
			workouts: {},

			// from Google auth API
			userID: "", // We use the Google ID as our user ID in Mongo as well
			name: "",
			email: "",

			// from Mongo
			userConfig: {
				calendarID: "",
				defaultView: defaultView.CALENDAR,
				mainTimezone: "America/Los_Angeles",
				startingDayOfWeek: 0,
				defaultRunDuration: 60,
				defaultStartTime: { hour: 7, minute: 0 },
				countdownConfig: {
					deadline: moment().format(serverDateFormat)
				},
			},
			weeklyGoals: {},
		}
	}

	componentDidMount() {
		const signInHandler = this.signinHandler.bind(this);

		window.gapi.load('auth2', function () {
			// Load+Init the auth2 instance here first. 
			// Subsequent calls to window.gapi don't need to init, just wait for load
			window.gapi.auth2.init({
				apiKey: gCalAPIKey,
				clientId: gClientID,
				discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"],
				scope: "https://www.googleapis.com/auth/calendar",
			}).then(
				// Check if user is already logged in.
				// If so, handle the signed in user.
				// If not, go to login page to get a GoogleUser object.
				(googleAuth) => {
					if (googleAuth.isSignedIn.get()) {
						signInHandler(true);
					} else {
						signInHandler(false);
					}
				},
				(err) => { console.log(err) }
			);
		});
	}

	//
	// New User Onboarding
	//

	initializeGCalCalendar(timezone, callback) {
		window.gapi.load('client:auth2', () => {
			window.gapi.client.load("calendar", "v3", () => {
				window.gapi.client.calendar.calendars.insert({
					'summary': gCalDefaultName, // Summary is the calendar name
					'timeZone': timezone,
				}).then((response) => { // For some reason, this call only works if you attach a .then() to it
					callback(response.result.id);
				});
			});
		});
	}

	authCodeHandler(authCode) {
		this.setState({ newUserAuthCode: authCode });
	}

	signinHandler(isSuccess) {
		// Handles all sign-ins (both first-time and existing)
		if (isSuccess) {
			window.gapi.auth2.getAuthInstance().then(gAuth => {
				const profile = gAuth.currentUser.get().getBasicProfile();
				const userID = profile.getId();
				const newState = {
					userID: userID,
					name: profile.getName(),
					email: profile.getEmail(),
					userIsLoaded: true,
					pendingUserLoading: false,
				};

				axios.post(dbAddress + "checkuser", { "id": userID })
					.then(res => {
						newState["userExists"] = res.data.userExists;
						if (res.data.userExists) {
							this.setState(newState, () => this.populateUser());
						} else {
							this.setState(newState);
						}
					});
			})
		} else {
			// If we've checked (pendingUserLoading) and didn't find a Google user (userIsLoaded),
			// it means the user needs to go through Google onboarding.
			this.setState({
				pendingUserLoading: false,
				userIsLoaded: false,
			});
		};
	}

	onboardingHandler(startingDayOfWeek, defaultView, mainTimezone, defaultRunDuration, defaultStartTime, autofillDistribution) {
		this.initializeGCalCalendar(mainTimezone, (calendarID) => {
			axios.post(dbAddress + "adduser",
				{
					_id: this.state.userID,
					calendarID: calendarID,
					config: {
						startingDayOfWeek: startingDayOfWeek,
						defaultView: defaultView,
						mainTimezone: mainTimezone,
						defaultRunDuration: defaultRunDuration,
						countdownConfig: {
							deadline: null,
						},
						defaultStartTime: defaultStartTime,
						autofillDistribution: autofillDistribution,
					},

					gTokens: {
						accessToken: '',
						refreshToken: '',
					}
				})
				.then(_res => {
					axios.post(dbAddress + 'inituserserverauth',
						{
							authCode: this.state.newUserAuthCode,
							userID: this.state.userID,
						},
						{ headers: { 'X-Requested-With': 'XMLHttpRequest' } },
					).then(_res => {
						this.setState(
							{
								userExists: true,
								newUserAuthCode: "",
							},
							() => this.populateUser()
						);
					});
				});
		});
	}

	//
	// Display handling
	//

	decrementMonth() {
		this.setState({ currentMonth: this.state.currentMonth.decrementMonth() }, () => { this.populateWorkouts() });
	}

	incrementMonth() {
		this.setState({ currentMonth: this.state.currentMonth.incrementMonth() }, () => { this.populateWorkouts() });
	}

	switchDisplayModes() {
		this.setState({ defaultView: this.state.defaultView === defaultView.CALENDAR ? defaultView.COUNTDOWN : defaultView.CALENDAR });
	}

	getCurrentDisplayStartEnd() {
		let startDate;
		let endDate;
		if (this.state.userConfig.defaultView === defaultView.CALENDAR) {
			startDate = this.state.currentMonth.getMonthStart();
			endDate = this.state.currentMonth.getMonthEnd();
		} else { // Countdown mode
			startDate = moment().format(serverDateFormat);
			endDate = this.state.userConfig.countdownConfig.deadline;
		}

		return ({ startDate: startDate, endDate: endDate });
	}

	toggleEditWorkoutModule(date = "", id = "") {
		let newState = {
			showingEditWorkoutModule: !this.state.editWorkoutModuleConfig.showingEditWorkoutModule
		};

		// If date is given, we're opening the module, and must populate the payload.
		if (date !== "") {
			// If no ID, we're creating a new workout.
			// Trigger the creation first on DB first, then populate the module with the resulting (empty) payload.
			if (id === "") {
				this.createNewWorkout(date);
				// Don't update EWMC state to show the module yet -- wait for object to be created in DB and FE to update.
				// The createNewWorkout function will set E to show.
			} else {
				newState.workoutID = id;
				newState.showingEditWorkoutModule = true; // Override in case the module is already open and a new date is selected
				this.setState({ editWorkoutModuleConfig: newState });
			}
		} else {
			this.setState({ editWorkoutModuleConfig: newState });
		}
	}

	//
	// Database access methods
	//

	populateUser() {
		// The if-check is just a safety measure -- this should never be called in those are both false
		if (this.state.userIsLoaded && this.state.userExists) {
			axios.get(dbAddress + "getuser/" + this.state.userID)
				.then(response => {
					this.setState({
						userConfig: response.data.config,
					});

					this.state.workoutHandler.setUserID(this.state.userID);
					this.state.workoutHandler.setCalendarID(this.state.userConfig.calendarID);
					this.state.workoutHandler.setMainTimezone(this.state.userConfig.mainTimezone);
					this.state.workoutHandler.setDefaultStartTime(this.state.userConfig.defaultStartTime);
					this.populateWorkouts();
					this.populateWeeklyGoals();
				});
		};
	}

	// Database access methods -- Workouts
	populateWorkouts() {
		const displayDates = this.getCurrentDisplayStartEnd();

		this.state.workoutHandler.pullWorkoutsFromDB(
			displayDates.startDate,
			displayDates.endDate,
			(workouts) => this.setState({ workouts: workouts })
		);
	}

	updateDayContent(id, payload) {
		this.state.workoutHandler.updateWorkout(id, payload, (displayWorkouts) => {
			const newState = { workouts: displayWorkouts };
			this.setState(newState);
		});
	}

	updateDB() {
		this.state.workoutHandler.syncToDB(workouts => this.setState({ workouts: workouts }));
	}

	// Creates one new workout. There are some indexing assumptions built on the fact that only 
	// one workout is created.
	createNewWorkout(date) {
		this.state.workoutHandler.addEmptyWorkout(date, (displayWorkouts, newWorkoutIDs) => {
			const newState = { workouts: displayWorkouts };
			// Clicking the "add workout" button won't trigger the opening of the AWM.
			// The EWM is opened here once the workout has been created in DB.
			newState.editWorkoutModuleConfig = { ...this.state.editWorkoutModuleConfig };
			newState.editWorkoutModuleConfig.workoutID = newWorkoutIDs[0];
			newState.editWorkoutModuleConfig.showingEditWorkoutModule = true;
			this.setState(newState);
		});
	}

	deleteWorkouts(workoutIDs) {
		this.state.workoutHandler.deleteWorkouts(
			workoutIDs,
			(newDisplayWorkouts) => { this.setState({ workouts: newDisplayWorkouts }) }
		);
	}

	// Database access methods -- Weekly Goals

	populateWeeklyGoals() {
		const displayDates = this.getCurrentDisplayStartEnd();

		axios.get(dbAddress + "getweeklygoalsforownerfordaterange/"
			+ this.state.userID + "/"
			+ displayDates.startDate + "/"
			+ displayDates.endDate)
			.then(response => {
				if (response) {
					// Note: this could pose issues by copying over a bunch of now-invalid goals if the start-of-week changes
					const goals = { ...this.state.weeklyGoals };
					response.data.goals.forEach(goal => {
						const formattedStartDate = moment(goal.payload.startDate).format(serverDateFormat);
						goals[formattedStartDate] = { payload: goal.payload, goalID: goal._id }; // Will overwrite an existing goal
					});

					this.setState({ weeklyGoals: goals });
				}
			});
	}

	sendWeeklyGoalsToDB(goalsToSend) {
		let goalsToAdd = [];
		let goalsToUpdate = [];

		if (!Array.isArray(goalsToSend)) {
			goalsToSend = [goalsToSend];
		}

		for (let i in goalsToSend) {
			const goal = goalsToSend[i];
			// Attach timezone info since Mongo Date representation requires it
			if ("goalID" in goal) {
				goalsToUpdate.push(goal);
			} else {
				goalsToAdd.push(goal);
			}
		}

		if (goalsToAdd.length > 0) {
			this.addNewWeeklyGoals(goalsToAdd);
		}

		if (goalsToUpdate.length > 0) {
			this.updateWeeklyGoals(goalsToUpdate);
		}
	}

	addNewWeeklyGoals(goalsToAdd) {
		const wrappedGoals = goalsToAdd.map(goal => {
			const wrappedGoal = { ...goal }
			wrappedGoal.ownerID = this.state.userID;
			return (wrappedGoal);
		});

		// Send goal to Mongo
		axios.post(dbAddress + "addweeklygoals", { "toAdd": wrappedGoals })
			.then(res => {
				const newGoalState = { ...this.state.weeklyGoals };
				res.data.goals.forEach(addedGoal => {
					const formattedStartDate = moment(addedGoal.payload.startDate).format(serverDateFormat);
					newGoalState[formattedStartDate] = {
						payload: addedGoal.payload,
						goalID: addedGoal._id,
					};
				});

				this.setState({ weeklyGoals: newGoalState });
			});
	}

	updateWeeklyGoals(goalsToUpdate) {
		const wrappedGoals = goalsToUpdate.map(goal => {
			return ({
				payload: goal.payload,
				goalID: goal.goalID,
				ownerID: this.state.userID,
			});
		});

		if (wrappedGoals.length > 0) {
			axios.post(dbAddress + "updateweeklygoals", { "toUpdate": wrappedGoals })
				.then(res => {
					const newGoals = { ...this.state.weeklyGoals };
					res.data.goals.forEach(goal => {
						const formattedStartDate = moment(goal.payload.startDate).format(serverDateFormat);
						newGoals[formattedStartDate] = {
							payload: goal.payload,
							goalID: goal._id,
						};
					});
					this.setState({ weeklyGoals: newGoals });
				});
		};
	}

	autofillWeeklyGoal(goalID) {
		axios.post(dbAddress + "autofillweek", { userID: this.state.userID, goalID: goalID })
			.then(res => {
				// res.data.added.forEach(workout => {
				//   /// HOW DO WE GET THESE INTO THE WORKOUT HANDLER?
				//   console.log(workout);
				// });

				// res.data.updated.forEach(workout => {
				//   console.log(workout);
				// });

				this.populateWorkouts();
			})
	}

	deleteWeeklyGoal(goalID) {

	}





	render() {
		if (this.state.pendingUserLoading) {
			return (null);
		}

		if (!this.state.userIsLoaded) {
			return (
				<LoginPage
					signinHandler={this.signinHandler}
					authCodeHandler={this.authCodeHandler}
				/>
			);
		};

		if (!this.state.userExists) {
			// User has now logged in via Google (userIsLoaded). 
			// If they're not in our DB (userExists), then we need to perform our own onboarding.
			return (<NewUserOnboarding onboardingHandler={this.onboardingHandler} />);
		};

		const currentMonth = this.state.currentMonth;
		const alternateDisplayMode =
			this.state.defaultView === defaultView.CALENDAR
				? defaultView.COUNTDOWN
				: defaultView.CALENDAR;
		const editWorkoutModuleConfig = this.state.editWorkoutModuleConfig;

		let editWorkoutModulePayload;
		if (this.state.editWorkoutModuleConfig.showingEditWorkoutModule
			&& this.state.editWorkoutModuleConfig.workoutID !== "") {
			// Showing existing workout
			editWorkoutModulePayload = this.state.workoutHandler.getWorkoutById(editWorkoutModuleConfig.workoutID);
		};
		// Need failure case

		const content =
			<div style={{ display: "flex" }}>
				<EditWorkoutModule
					show={editWorkoutModuleConfig.showingEditWorkoutModule}
					onClose={() => this.toggleEditWorkoutModule("", "")}
					updateDayContentFunc={(workoutID, content) => this.updateDayContent(workoutID, content)}
					deleteWorkoutFunc={(workoutID) => this.deleteWorkouts([workoutID])}
					payload={editWorkoutModulePayload}
					id={editWorkoutModuleConfig.workoutID}
				/>
				<div style={{ flex: "1" }}>
					<Calendar
						currentMonth={currentMonth.getMonthInfo()}
						decrementMonthHandler={() => this.decrementMonth()}
						incrementMonthHandler={() => this.incrementMonth()}
						addNewWorkoutHandler={(date, id) => this.toggleEditWorkoutModule(date, id)}
						workouts={this.state.workouts}
						sendWeeklyGoalsToDBHandler={(newGoals) => this.sendWeeklyGoalsToDB(newGoals)}
						autofillWeeklyGoalHandler={(goalID) => this.autofillWeeklyGoal(goalID)}
						weeklyGoals={this.state.weeklyGoals}
						deadline={this.state.userConfig.countdownConfig.deadline}
						defaultView={this.state.userConfig.defaultView}
						startingDayOfWeek={this.state.userConfig.startingDayOfWeek}
						mainTimezone={this.state.userConfig.mainTimezone}
					/>
				</div>
			</div>;

		return (
			<div>
				<h1>{"Hi " + this.state.name + "!"}</h1>

				<button onClick={() => this.switchDisplayModes()}>
					{"Switch to " + alternateDisplayMode + " mode"}
				</button>
				<button onClick={() => this.updateDB()}>
					Save Edits
				</button>

				{content}
			</div>
		);
	}
}

function App() {
	return (
		<Router>
			<Route path="/" exact component={MainPanel} />
		</Router>
	);
}

export default App;
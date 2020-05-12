import React from 'react';
import { Box, Grid, Grommet, Layer, Button } from 'grommet';
import { Close } from 'grommet-icons';
import './App.css';
import { BrowserRouter as Router, Route } from 'react-router-dom';
import axios from 'axios';

import { 
	defaultView, 
	serverDateFormat, 
	dbAddress, 
	gClientID, 
	gCalAPIKey, 
	gCalDefaultName, 
	creationTypes, 
	grommetTheme, 
	workoutTypes,
	getNumberOfDaysInMonth,
	autofillDistributions,
	dark1,
	light,
} from './configs';
import LoginPage from "./LoginPage";
import SettingsModule from "./SettingsModule";
import EditWorkoutModule from "./EditWorkoutModule";
import Calendar from "./CalendarDisplay";
import HeaderModule from './HeaderModule';

var moment = require('moment-timezone');

class MonthHandler {
	// Defaults to current month if none is given
	constructor(now = moment()) {
		this.currentMonth = now; // MomentJS's months are 0 indexed
	}

	getFormattedMonth() {
		return this.currentMonth.format("YYYY-MM");
	}

	getStartingDayOfWeek(month, year) {
		const date = new Date();
		date.setFullYear(year);
		date.setMonth(month);
		date.setDate(1);

		return (date.getDay());
	}

	getMonthInfo() {
		const now = this.currentMonth; // Moment's months are 0 indexed (0 is January)
		return ({
			totalDays: getNumberOfDaysInMonth(now.month(), now.year()),
			startingDayOfWeek: this.getStartingDayOfWeek(now.month(), now.year()), // 0 is Sunday
			month: now.format("YYYY-MM"),
		});
	}

	getMonthStart() {
		return this.getMonthInfo().month + "-01";
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

	resetToCurrentMonth() {
		return new MonthHandler();
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
			type: workoutTypes.RECOVERY,
			mileage: {
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
					const newTitle = this.workouts[workoutID].mileage.goal + " mile run";
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

	removeWorkoutsLocally(workoutIDs, callback) {
		workoutIDs.forEach(deleted => {
			delete this.workouts[deleted.id];
			const formattedStartDate = moment(deleted.startDate).format(serverDateFormat);
			const toDeleteIdx = this.dates[formattedStartDate].indexOf(deleted.id);
			this.dates[formattedStartDate].splice(toDeleteIdx, 1);

			// Need to delete the list otherwise the Calendar won't know to generate 
			// empty prop for the DayCell
			if (this.dates[formattedStartDate].length === 0) {
				delete this.dates[formattedStartDate];
			}
		});

		if (callback) {
			callback(this.generateDisplayWorkouts());
		}
	}

	deleteWorkouts(workoutIDs, callback) {
		axios.post(dbAddress + "deleteworkouts", { userID: this.userID, toDelete: workoutIDs })
			.then(res => {
				if (res) {
					this.removeWorkoutsLocally(res.data.deleted);
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
		Object.keys(this.dates).forEach(date => {
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
		this.toggleSettingsModule = this.toggleSettingsModule.bind(this);
		this.signinHandler = this.signinHandler.bind(this);
		this.authCodeHandler = this.authCodeHandler.bind(this);
		this.onboardingHandler = this.onboardingHandler.bind(this);
		this.updateUserSettingsHandler = this.updateUserSettingsHandler.bind(this);
		this.updateDB = this.updateDB.bind(this);

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
			showSettingsModule: false,
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
				autofillConfig: {
					distribution: autofillDistributions.EVEN, // default value
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
						newState.userExists = res.data.userExists;
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

	onboardingHandler(newUserConfig) {
		//  don't forget to add in countdownconfig when we're read
		this.initializeGCalCalendar(newUserConfig.mainTimezone, (calendarID) => {
			axios.post(dbAddress + 'adduser',
				{
					_id: this.state.userID,
					calendarID: calendarID,
					config: newUserConfig,
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
	
	updateUserSettingsHandler(newUserConfig) {
		axios.post(dbAddress + 'updateuser',
			{
				id: this.state.userID,
				config: newUserConfig,
			}
		).then(res => {
			this.populateUser();
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

	resetToCurrentMonth() {
		this.setState({ currentMonth: this.state.currentMonth.resetToCurrentMonth() }, () => { this.populateWorkouts() });
	}

	switchDisplayModes() {
		this.setState({ defaultView: this.state.defaultView === defaultView.CALENDAR ? defaultView.COUNTDOWN : defaultView.CALENDAR });
	}

	// This function is used to determine what range of workouts to pull.
	// The week buffer on either end is to account for the edges of the month.
	getCurrentDisplayedRange() {
		let startDate;
		let endDate;
		if (this.state.userConfig.defaultView === defaultView.CALENDAR) {
			startDate = 
				moment(this.state.currentMonth.getMonthStart())
				.subtract(1, 'week')
				.format(serverDateFormat);
			endDate = 
				moment(this.state.currentMonth.getMonthEnd())
				.add(1, 'week')
				.format(serverDateFormat);
		} else { // Countdown mode
			startDate = moment().format(serverDateFormat);
			endDate = this.state.userConfig.countdownConfig.deadline;
		}

		return ({ startDate: startDate, endDate: endDate });
	}

	toggleEditWorkoutModule(date = "", id = "", callback) {
		let newState = {
			showingEditWorkoutModule: !this.state.editWorkoutModuleConfig.showingEditWorkoutModule
		};

		// If date is given, we're opening the module, and must populate the payload.
		if (date !== "") {
			// If no ID, we're creating a new workout.
			// Trigger the creation first on DB first, then populate the module with the resulting (empty) payload.
			if (id === "") {
				this.createNewWorkout(date, callback);
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

	toggleSettingsModule() {
		this.setState({showSettingsModule: !this.state.showSettingsModule});
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
		const displayDates = this.getCurrentDisplayedRange();

		this.state.workoutHandler.pullWorkoutsFromDB(
			displayDates.startDate,
			displayDates.endDate,
			(workouts) => { this.setState({ 'workouts': workouts }) }
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
	createNewWorkout(date, callbackk) {
		this.state.workoutHandler.addEmptyWorkout(date, (displayWorkouts, newWorkoutIDs) => {
			const newState = { workouts: displayWorkouts };
			// Clicking the "add workout" button won't trigger the opening of the AWM.
			// The EWM is opened here once the workout has been created in DB.
			newState.editWorkoutModuleConfig = { ...this.state.editWorkoutModuleConfig };
			newState.editWorkoutModuleConfig.workoutID = newWorkoutIDs[0];
			newState.editWorkoutModuleConfig.showingEditWorkoutModule = true;
			this.setState(newState);
			callbackk(true);
		});
	}

	deleteWorkouts(workoutIDs, callback) {
		this.state.workoutHandler.deleteWorkouts(
			workoutIDs,
			(newDisplayWorkouts) => { 
				this.setState(
					{ 
						workouts: newDisplayWorkouts,
						editWorkoutModuleConfig: {
							showingEditWorkoutModule: false,
							workoutID: "",
							workoutDate: "",
						},
					}, 
					callback(true)
				);
			}
		);
	}

	// Database access methods -- Weekly Goals

	populateWeeklyGoals() {
		const displayDates = this.getCurrentDisplayedRange();

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

	autofillWeeklyGoal(goalID, callback) {
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
				callback(true);
			});
	}

	clearWorkoutsForGoal(goalID, callback) {
		axios.post(dbAddress + 'clearworkoutsforgoal', { userID: this.state.userID, goalID: goalID })
			.then(res => {
				this.state.workoutHandler.removeWorkoutsLocally(res.data.deleted, (newDisplayWorkouts) => {
					this.setState({workouts: newDisplayWorkouts});
				});
				callback(true);
			});
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
			return (
				<Grommet 
					theme={grommetTheme}
					full
					background={light}
				>
					<SettingsModule
						useDefaultSettings={true}
						titleText='Welcome to RunPlanner'
						subtitleText="Let's set some settings. If you're unsure of anything, the defaults will take care of you, and you can always change your settings later."
						submitHandler={this.onboardingHandler}
					/>
				</Grommet>
			);
		};

		// // short circuit for testing. remember to remove
		// return (
		// 	<Grommet 
		// 		theme={grommetTheme}
        //         full
        //         background='light-1'
		// 	>
		// 		<SettingsModule
		// 			useDefaultSettings={true}
		// 			titleText='Welcome to RunPlanner'
		// 			subtitleText="Let's set some settings. If you're unsure of anything, the defaults will take care of you, and you can always change your settings later."
		// 			submitHandler={this.onboardingHandler}
		// 		/>
		// 	</Grommet>
		// );

		const currentMonth = this.state.currentMonth;
		// const alternateDisplayMode =
		// 	this.state.defaultView === defaultView.CALENDAR
		// 		? defaultView.COUNTDOWN
		// 		: defaultView.CALENDAR;
		const editWorkoutModuleConfig = this.state.editWorkoutModuleConfig;

		let editWorkoutModulePayload;
		if (this.state.editWorkoutModuleConfig.showingEditWorkoutModule
			&& this.state.editWorkoutModuleConfig.workoutID !== "") {
			// Showing existing workout
			editWorkoutModulePayload = this.state.workoutHandler.getWorkoutById(editWorkoutModuleConfig.workoutID);
		};
		// Need failure case

		const content =
			<Grid
				columns={['auto', '300px']}
				rows={['xsmall', 'flex']}
				fill={true}
				areas={[
					{
						name: 'calendarControl',
						start: [0,0],
						end: [0,0],
					},
					{
						name: 'header',
						start: [1,0],
						end: [1,0],
					},
					{
						name: 'calendar', 
						start: [0,1],
						end: [0,1],
					},
					{
						name: 'editWorkoutModule',
						start: [1,1],
						end: [1,1],
					},
				]}
			>
				{	
					this.state.showSettingsModule &&
					<Layer
						onEsc={() => this.toggleSettingsModule()}
						onClickOutside={() => this.toggleSettingsModule()}
					>
						<div style={{overflow: 'scroll'}}>
							<Button 
								icon={<Close />}
								onClick={() => this.setState({showSettingsModule: false})}
							/>
							<SettingsModule
								useDefaultSettings={false}
								titleText='Settings'
								submitHandler={this.updateUserSettingsHandler}
								existingSettings={this.state.userConfig}
							/>
						</div>
					</Layer>
				}
				<HeaderModule
					name={this.state.name}
					toggleSettingsPageFunc={this.toggleSettingsModule}
				/>
				<Calendar
					currentMonth={currentMonth.getMonthInfo()}
					decrementMonthHandler={() => this.decrementMonth()}
					incrementMonthHandler={() => this.incrementMonth()}
					resetToCurrentMonthHandler={() => this.resetToCurrentMonth()}
					addNewWorkoutHandler={(date, id, callback) => this.toggleEditWorkoutModule(date, id, callback)}
					workouts={this.state.workouts}
					sendWeeklyGoalsToDBHandler={(newGoals) => this.sendWeeklyGoalsToDB(newGoals)}
					autofillWeeklyGoalHandler={(goalID, callback) => this.autofillWeeklyGoal(goalID, callback)}
					clearWorkoutsForGoalHandler={(goalID, callback) => this.clearWorkoutsForGoal(goalID, callback)}
					weeklyGoals={this.state.weeklyGoals}
					// deadline={this.state.userConfig.countdownConfig.deadline}
					defaultView={this.state.userConfig.defaultView}
					startingDayOfWeek={this.state.userConfig.startingDayOfWeek}
					mainTimezone={this.state.userConfig.mainTimezone}
					selectedWorkoutID={editWorkoutModuleConfig.workoutID}
				/>
				<Box 
					gridArea='editWorkoutModule'
					background={dark1}
				>
					<EditWorkoutModule
						show={editWorkoutModuleConfig.showingEditWorkoutModule}
						onClose={() => this.toggleEditWorkoutModule("", "")}
						updateDayContentFunc={(workoutID, content) => this.updateDayContent(workoutID, content)}
						deleteWorkoutFunc={(workoutID, callback) => this.deleteWorkouts([workoutID], callback)}
						payload={editWorkoutModulePayload}
						id={editWorkoutModuleConfig.workoutID}
						saveFunc={() => this.updateDB()}
						name={this.state.name}
					/>
				</Box>
			</Grid>;

		return (
			<Grommet 
				theme={grommetTheme}
				full={true}
			>
				{/* <button onClick={() => this.switchDisplayModes()}>
					{"Switch to " + alternateDisplayMode + " mode"}
				</button> */}
				{content}
			</Grommet>
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
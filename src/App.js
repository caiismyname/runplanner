import React from 'react';
import './App.css';
import { BrowserRouter as Router, Route } from 'react-router-dom';
import axios from 'axios';

import {defaultView, serverDateFormat, dbAddress, gClientID, gCalAPIKey, gCalDefaultName} from './configs';
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
  constructor(userID = "", calendarID = "", mainTimezone = "", defaultRunDuration = 60) {
    this.userID = userID;
    this.calendarID = calendarID;
    this.workouts = {}; // Key = MongoId, Value = workout details
    this.dates = {}; // Key = date, Value = MongoId (to use as reference into above dict)
    this.gEventIDs = {}; // Key = MongoId, Value = Google Calendar event ID
    this.modified = [];
    this.mainTimezone = mainTimezone;
    this.defaultRunDuration = defaultRunDuration;
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

  generateEmptyPayload(givenDate) {
    const defaultStartTime = {hour: 7, minute: 0}; // 24 hour time

    let date = moment(givenDate);
    date.hour(defaultStartTime.hour);
    date.minute(defaultStartTime.minute);
    date = moment.tz(date, this.mainTimezone);
    
    return ({
      date: date.toISOString(),
      content: "",
      type: "",
      milage: {
        goal: 0,
        // actual: 0,
      },
    });
  }

  addEmptyWorkout(date, callback) {
    this.addWorkouts([this.generateEmptyPayload(date)], callback);
  }

  addWorkouts(payloads, callback) {
    const wrappedPayloads = payloads.map(payload => {
      const wrappedPayload = {};
      wrappedPayload.payload = payload;
      wrappedPayload.owner = this.userID;
      return (wrappedPayload);
      // addGCalEvent() will add `gEventID` to this object before passing to Mongo
    });

    this.addGCalEvents(wrappedPayloads, (workouts) => {
      // Send workout to Mongo
      axios.post(dbAddress + "addworkouts", {"toAdd": wrappedPayloads})
      .then(res => {
        console.log(res.data);
        const newWorkoutIDs = [];
        for (let i = 0; i < res.data.ids.length; i++) {
          // Once workout is confirmed in Mongo, add the workout to local state.
          // This assumes that workout IDs are returned in the order in which the workouts were sent
          const newWorkoutID = res.data.ids[i];
          newWorkoutIDs.push(newWorkoutID);
          this.workouts[newWorkoutID] = workouts[i].payload;
          this.gEventIDs[newWorkoutID] = workouts[i].gEventID;
          
          const date = moment(workouts[i].payload.date).format(serverDateFormat);
          if (date in this.dates) {
            this.dates[date].push(newWorkoutID);
          } else {
            this.dates[date] = [newWorkoutID];
          };
        }
        
        callback(this.generateDisplayWorkouts(), newWorkoutIDs);
      });
    });
  }

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
                  'dateTime': payload.date,
                  'timeZone': this.timeZone
                },
                'end': {
                  'dateTime': moment(payload.date).add(this.defaultRunDuration, "minutes").toISOString(),
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
    // "Modified" workouts are workouts that have already been pushed to DB.
    if (!(this.modified.includes(id))) {
      this.modified.push(id);
    };
    callback(this.generateDisplayWorkouts());
  }

  updateGCalEvents(workoutIDs) {
    window.gapi.load('client:auth2', () => {   
      window.gapi.client.load("calendar", "v3", () => {
        const batch = window.gapi.client.newBatch();

        workoutIDs.forEach(workoutID => {
          const gEventID = this.gEventIDs[workoutID];
          // const newTitle = this.workouts[workoutID].content;
          const newTitle = this.workouts[workoutID].milage.goal + " mile run";
          const newStart = this.workouts[workoutID].date;

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

  syncToDB(callback) {
    // TODO do these still need to be deduped?
    const modified = [...new Set(this.modified)]; // Dedup the list
    const workoutsToUpdate = modified.map(workoutID => {
      let res = {};
      res.payload = this.workouts[workoutID];
      res.owner = this.userID;
      res.id = workoutID;
      res.gEventID = this.gEventIDs[workoutID];

      return res;
    });
    
    if (workoutsToUpdate.length > 0) {
      this.updateGCalEvents(modified);
      axios.post(dbAddress + "updateworkouts", {"toUpdate": workoutsToUpdate})
        .then(res => {
          console.log(res.data);
          this.modified = [];
          callback(this.generateDisplayWorkouts());
        });
    };

    //TODO this should then repull from DB to keep db and FE in sync
  }

  pullWorkoutsFromDB(startDate, endDate, callback) {
    axios.get(dbAddress + "getworkoutsforownerfordaterange/" 
      + this.userID + "/" 
      + startDate + "/"
      + endDate)
      .then(response => {
        if (response) {
          response.data.forEach(workout => {
          // Current choice is to always overwrite local info with DB info if conflict exists. 
            this.workouts[workout.id] = workout.payload;
            this.gEventIDs[workout.id] = workout.gEventID;
            
            const formattedDate = moment(workout.payload.date).format(serverDateFormat);
            if (formattedDate in this.dates) {
              this.dates[formattedDate].push(workout.id);
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
        workoutsOnDate.push({payload: this.workouts[workoutID], id: workoutID});
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
    this.onboardingHandler = this.onboardingHandler.bind(this);

    this.state = {
      // local state control (not loaded from anywhere)
      pendingUserLoading: true,
      userIsLoaded: false, // Has the user logged in via Google OAuth?
      userExists: false, // Is the Google userID in our DB?
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
      calendarID: "",
      defaultView: defaultView.CALENDAR,
      mainTimezone: "America/Los_Angeles",
      startingDayOfWeek: 0,
      defaultRunDuration: 60,
      countdownConfig: {
        deadline: moment().format(serverDateFormat)
      },
      weeklyGoals: {},
    }
  }

  componentDidMount() {
    const handler = this.signinHandler.bind(this);

    window.gapi.load('auth2', function() {
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
          // unsure if this listener works / is necessary
          // googleAuth.isSignedIn.listen(isSignedIn => {
          //   handler(isSignedIn, googleAuth.currentUser.get());
          // });

          if (googleAuth.isSignedIn.get()) {
            handler(true, googleAuth.currentUser.get());
          } else {
            handler(false, null);
          }
        },
        (err) => {console.log(err)} 
      );
    });

    this.populateUser();
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
          console.log(response);
          callback(response.result.id);
        });
      });
    });
  }
  
  signinHandler(isSuccess, googleUser) {
    if (isSuccess) {
      const profile = googleUser.getBasicProfile();
      const userID = profile.getId();
      const newState = {
        userID: userID,
        name: profile.getName(),
        email: profile.getEmail(),
        userIsLoaded: true,
        pendingUserLoading: false,
      };

      axios.post(dbAddress + "checkuser", {"id": userID})
      .then(res => {
        newState["userExists"] = res.data.userExists;
        this.setState(newState, () => this.populateUser());
      });
    } else {
      this.setState({pendingUserLoading: false, userIsLoaded: false});
    };
  }

  onboardingHandler(startingDayOfWeek, defaultView, mainTimezone, defaultRunDuration) {
    const userID = this.state.userID;
    this.initializeGCalCalendar(mainTimezone, (calendarID) => {
      axios.post(dbAddress + "adduser", 
        {
          "_id": userID,
          "calendarID": calendarID,
          "config": {
            "startingDayOfWeek": startingDayOfWeek,
            "defaultView": defaultView,
            "mainTimezone": mainTimezone,
            "defaultRunDuration": defaultRunDuration,
          },
          "countdownConfig": {
            "deadline": null,
          },
        })
      .then(res => {
        this.setState({userExists: true}, () => this.populateUser());
      });
    });
  }

  //
  // Display handling
  //

  decrementMonth() {
    this.setState({currentMonth: this.state.currentMonth.decrementMonth()}, () => {this.populateWorkouts()});
  }

  incrementMonth() {
    this.setState({currentMonth: this.state.currentMonth.incrementMonth()}, () => {this.populateWorkouts()});
  } 

  switchDisplayModes() {
    this.setState({defaultView: this.state.defaultView === defaultView.CALENDAR ? defaultView.COUNTDOWN : defaultView.CALENDAR});
  }

  getCurrentDisplayStartEnd() {
    let startDate;
    let endDate;
    if (this.state.defaultView === defaultView.CALENDAR) {
      startDate = this.state.currentMonth.getMonthStart();
      endDate = this.state.currentMonth.getMonthEnd();
    } else { // Countdown mode
      startDate = moment().format(serverDateFormat);
      endDate = this.state.countdownConfig.deadline;
    }

    return ({startDate: startDate, endDate: endDate});
  }

  toggleEditWorkoutModule(date="", id="") {
    let newState = {
      showingEditWorkoutModule: !this.state.editWorkoutModuleConfig.showingEditWorkoutModule
    };
    
    // If date is given, we're opening the module, and must populate the payload.
    if (date !== "") {
      // If no ID, we're creating a new workout.
      // Trigger the creation first on DB first, then populate the module with the resulting (empty) payload.
      if (id === "" ) {
        // this.updateDayContent(id, this.state.workoutHandler.generateEmptyPayload(date));
        this.createNewWorkout(date);
        // Don't update EWMC state to show the module yet -- wait for object to be created in DB and FE to update.
        // The createNewWorkout function will set E to show.
      } else {
        newState.workoutID = id;
        newState.showingEditWorkoutModule = true; // Override in case the module is already open and a new date is selected
        this.setState({editWorkoutModuleConfig: newState});
      };
    };
  }
  
  //
  // Database access methods
  //

  populateUser() {
    if (this.state.userIsLoaded && this.state.userExists) {
      axios.get(dbAddress + "getuser/" + this.state.userID)
        .then(response => {
          this.setState({
            // TODO would it be easier if we just kept a "config" object in state?
            "defaultView": response.data.config.defaultView,
            "mainTimezone": response.data.config.mainTimezone,
            "startingDayOfWeek": response.data.config.startingDayOfWeek,
            "defaultRunDuration": response.data.config.defaultRunDuration,
            "calendarID": response.data.calendarID,
            "countdownConfig": response.data.countdownConfig,
          });
          
          this.state.workoutHandler.setUserID(this.state.userID);
          this.state.workoutHandler.setCalendarID(this.state.calendarID);
          this.state.workoutHandler.setMainTimezone(this.state.mainTimezone);
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
      (workouts) => this.setState({workouts: workouts})
    );
  }

  updateDayContent(id, payload) {
    this.state.workoutHandler.updateWorkout(id, payload, (displayWorkouts) => {
      const newState = {workouts: displayWorkouts};
      this.setState(newState);
    });
  }

  updateDB() {
    this.state.workoutHandler.syncToDB(workouts => this.setState({workouts: workouts}));
  }

  // Creates one new workout. There are some indexing assumptions built on the fact that only 
  // one workout is created.
  createNewWorkout(date) {
    this.state.workoutHandler.addEmptyWorkout(date, (displayWorkouts, newWorkoutIDs) => {
      const newState = {workouts: displayWorkouts};
      // Clicking the "add workout" button won't trigger the opening of the AWM.
      // The AWM is opened here once the workout has been created in DB.
      newState.editWorkoutModuleConfig = { ...this.state.editWorkoutModuleConfig};
      newState.editWorkoutModuleConfig.workoutID = newWorkoutIDs[0];
      newState.editWorkoutModuleConfig.showingEditWorkoutModule = true;
      this.setState(newState);
    });
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
        const goals = {...this.state.weeklyGoals};
        response.data.forEach(goal => {
            const formattedStartDate = moment(goal.startDate).format(serverDateFormat);
            goals[formattedStartDate] = goal; // Will overwrite an existing goal
        });
        
        this.setState({weeklyGoals: goals});
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
      goal.startDate = moment.tz(goal.startDate, this.state.mainTimezone);
      goal.endDate = moment.tz(goal.endDate, this.state.mainTimezone);
      if ("goalID" in goal) {
        goalsToUpdate.push(goal);
      } else {
        goalsToAdd.push(goal);
      }
    }

    if (goalsToAdd.length > 0 ) {
      this.addNewWeeklyGoals(goalsToAdd);
    }

    if (goalsToUpdate.length > 0) {
      this.updateWeeklyGoals(goalsToUpdate);
    }
  }

  addNewWeeklyGoals(goalsToAdd) {
    const wrappedGoals = goalsToAdd.map(goal => {
      const wrappedGoal = {...goal}
      wrappedGoal.ownerID = this.state.userID;
      return (wrappedGoal);
    });

    // Send workout to Mongo
    axios.post(dbAddress + "addweeklygoals", {"toAdd": wrappedGoals})
    .then(res => {
        console.log(res.data);
        const newGoals = {...this.state.weeklyGoals};
        for (let i = 0; i < res.data.ids.length; i++) {
            const newGoal = {...goalsToAdd[i]};
            // Strip time/timezone info
            newGoal.startDate = moment(newGoal.startDate).format(serverDateFormat);
            newGoal.endDate = moment(newGoal.endDate).format(serverDateFormat);
            
            newGoal.goalID = res.data.ids[i];
            newGoals[newGoal.startDate] = newGoal;
        }
        
        this.setState({weeklyGoals: newGoals});
    });
  }

  updateWeeklyGoals(goalsToUpdate) {
    const wrappedGoals = goalsToUpdate.map(goal => {
      const wrappedGoal = {...goal};
      wrappedGoal.ownerID = this.state.userID;

      return(wrappedGoal);
    });
    
    if (wrappedGoals.length > 0) {
      axios.post(dbAddress + "updateweeklygoals", {"toUpdate": wrappedGoals})
        .then(res => {
          console.log(res.data);

          const newState = {...this.state.weeklyGoals};
          goalsToUpdate.forEach(goal => {
            // Strip time info
            goal.startDate = moment(goal.startDate).format(serverDateFormat);
            goal.endDate = moment(goal.endDate).format(serverDateFormat);
            newState[goal.startDate] = goal
          });
          this.setState({weeklyGoals: newState});
        });
    };
  }

  deleteWeeklyGoal(goalID) {

  }





  render() {
    if(this.state.pendingUserLoading) {
      return(null);
    }

    if (!this.state.userIsLoaded) {
      return(<LoginPage signinHandler={this.signinHandler}/>);
    };
    
    if (!this.state.userExists) {
      return(<NewUserOnboarding onboardingHandler={this.onboardingHandler}/>);
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
      <div style={{display: "flex"}}>
          <EditWorkoutModule
            show={editWorkoutModuleConfig.showingEditWorkoutModule}
            onClose={() => this.toggleEditWorkoutModule("", "")}
            updateDayContentFunc={(workoutID, content) => this.updateDayContent(workoutID, content)}
            payload={editWorkoutModulePayload}
            id={editWorkoutModuleConfig.workoutID}
          />
        <div style={{flex: "1"}}>
          <Calendar 
            currentMonth={currentMonth.getMonthInfo()}
            decrementMonthHandler={() => this.decrementMonth()}
            incrementMonthHandler={() => this.incrementMonth()} 
            addNewWorkoutHandler={(date, id) => this.toggleEditWorkoutModule(date, id)}
            workouts={this.state.workouts}
            sendWeeklyGoalsToDBHandler={(newGoals) => this.sendWeeklyGoalsToDB(newGoals)}
            weeklyGoals={this.state.weeklyGoals}
            deadline={this.state.countdownConfig.deadline}
            defaultView={this.state.defaultView}
            startingDayOfWeek={this.state.startingDayOfWeek}
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
      <Route path="/" exact component={MainPanel}/>
    </Router>
  );
}

export default App;
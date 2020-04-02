import React from 'react';
import './App.css';
import { BrowserRouter as Router, Route } from 'react-router-dom';
import axios from 'axios';

import {defaultView, serverDateFormat, dbAddress, gClientID, gCalAPIKey, gCalDefaultName} from './configs';
import LoginPage from "./LoginPage";
import NewUserOnboarding from "./NewUserOnboarding";
import NewWorkoutModule from "./NewWorkoutModule";
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
  constructor(userID = "", calendarId = "", mainTimezone = "", defaultRunDuration = 60) {
    this.userID = userID;
    this.calendarId = calendarId;
    this.workouts = {}; // Key = MongoId, Value = workout details
    this.dates = {}; // Key = date, Value = MongoId (to use as reference into above dict)
    this.gEventIds = {}; // Key = MongoId, Value = Google Calendar event ID
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

  setCalendarId(id) {
    this.calendarId = id;
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
      // addGCalEvent() will add `gEventId` to this object before passing to Mongo
    });

    this.addGCalEvents(wrappedPayloads, (workouts) => {
      // Send workout to Mongo
      axios.post(dbAddress + "addworkouts", {"toAdd": wrappedPayloads})
      .then(res => {
        console.log(res.data);
        const newWorkoutIds = [];
        for (let i = 0; i < res.data.ids.length; i++) {
          // Once workout is confirmed in Mongo, add the workout to local state.
          // This assumes that workout IDs are returned in the order in which the workouts were sent
          const newWorkoutId = res.data.ids[i];
          newWorkoutIds.push(newWorkoutId);
          this.workouts[newWorkoutId] = workouts[i].payload;
          this.gEventIds[newWorkoutId] = workouts[i].gEventId;
          
          const date = moment(workouts[i].payload.date).format(serverDateFormat);
          if (date in this.dates) {
            this.dates[date].push(newWorkoutId);
          } else {
            this.dates[date] = [newWorkoutId];
          };
        }
        
        callback(this.generateDisplayWorkouts(), newWorkoutIds);
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
              'calendarId': this.calendarId,
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
          const payloadsWithGEventId = [...payloads];
          let payloadIdx = 0;
          for (var eventIdx in response.result) {
            payloadsWithGEventId[payloadIdx].gEventId = response.result[eventIdx].result.id;
            payloadIdx += 1;
          }
          callback(payloadsWithGEventId);
        });
      });
    });
  }

  // no date changes for now TODO add date changes
  updateWorkout(id, payload, callback) {
    // This funciton does not push updates to DB, it just marks workouts that need to be pushed upon save.
    this.workouts[id] = payload;
    console.log(payload);
    // "Modified" workouts are workouts that have already been pushed to DB.
    if (!(this.modified.includes(id))) {
      this.modified.push(id);
    };
    callback(this.generateDisplayWorkouts());
  }

  updateGCalEvents(workoutIds) {
    window.gapi.load('client:auth2', () => {   
      window.gapi.client.load("calendar", "v3", () => {
        const batch = window.gapi.client.newBatch();

        workoutIds.forEach(workoutId => {
          const gEventId = this.gEventIds[workoutId];
          // const newTitle = this.workouts[workoutId].content;
          const newTitle = this.workouts[workoutId].milage.goal + " mile run";
          const newStart = this.workouts[workoutId].date;

          batch.add(window.gapi.client.calendar.events.update(
            {
              'calendarId': this.calendarId,
              'eventId': gEventId,
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
    const workoutsToUpdate = modified.map(workoutId => {
      let res = {};
      res.payload = this.workouts[workoutId];
      res.owner = this.userID;
      res.id = workoutId;
      res.gEventId = this.gEventIds[workoutId];

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
            this.gEventIds[workout.id] = workout.gEventId;
            
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
      this.dates[date].forEach((workoutId) => {
        workoutsOnDate.push({payload: this.workouts[workoutId], id: workoutId});
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
    this.toggleAddWorkoutModule = this.toggleAddWorkoutModule.bind(this);
    this.signinHandler = this.signinHandler.bind(this);
    this.onboardingHandler = this.onboardingHandler.bind(this);

    this.state = {
      // local state control (not loaded from anywhere)
      pendingUserLoading: true,
      userIsLoaded: false, // Has the user logged in via Google OAuth?
      userExists: false, // Is the Google userID in our DB?
      addWorkoutModuleConfig: {
        showingAddWorkoutModule: false,
        workoutId: "",
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
      calendarId: "",
      defaultView: defaultView.CALENDAR,
      mainTimezone: "America/Los_Angeles",
      startingDayOfWeek: 0,
      defaultRunDuration: 60,
      countdownConfig: {
        deadline: moment().format(serverDateFormat)
      },
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
    const userId = this.state.userID;
    this.initializeGCalCalendar(mainTimezone, (calendarId) => {
      axios.post(dbAddress + "adduser", 
        {
          "_id": userId,
          "calendarId": calendarId,
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

  decrementMonth() {
    this.setState({currentMonth: this.state.currentMonth.decrementMonth()}, () => {this.populateWorkouts()});
  }

  incrementMonth() {
    this.setState({currentMonth: this.state.currentMonth.incrementMonth()}, () => {this.populateWorkouts()});
  } 

  switchDisplayModes() {
    this.setState({defaultView: this.state.defaultView === defaultView.CALENDAR ? defaultView.COUNTDOWN : defaultView.CALENDAR});
  }

  populateUser() {
    if (this.state.userIsLoaded && this.state.userExists) {
      axios.get(dbAddress + "getuser/" + this.state.userID)
        .then(response => {
          this.setState({
            // TODO would it be easier if we just kept a "config" object in state?
            "defaultView": response.data.config.defaultView,
            "mainTimezone": response.data.config.mainTimezone,
            "countdownConfig": response.data.countdownConfig,
            "startingDayOfWeek": response.data.config.startingDayOfWeek,
            "defaultRunDuration": response.data.config.defaultRunDuration,
            "calendarId": response.data.calendarId,
          });
          
          this.state.workoutHandler.setUserID(this.state.userID);
          this.state.workoutHandler.setCalendarId(this.state.calendarId);
          this.state.workoutHandler.setMainTimezone(this.state.mainTimezone);
          this.populateWorkouts();
        });
      };
  }

  populateWorkouts() {
    let startDate;
    let endDate;
    if (this.state.defaultView === defaultView.CALENDAR) {
      startDate = this.state.currentMonth.getMonthStart();
      endDate = this.state.currentMonth.getMonthEnd();
    } else { // Countdown mode
      startDate = moment().format(serverDateFormat);
      endDate = this.state.countdownConfig.deadline;
    }

    this.state.workoutHandler.pullWorkoutsFromDB(
      startDate, 
      endDate, 
      (workouts) => this.setState({workouts: workouts})
    );
  }

  updateDB() {
    this.state.workoutHandler.syncToDB(workouts => this.setState({workouts: workouts}));
  }

  updateDayContent(id, payload) {
    this.state.workoutHandler.updateWorkout(id, payload, (displayWorkouts) => {
      const newState = {workouts: displayWorkouts};
      this.setState(newState);
    });
  }

  // Creates one new workout. There are some indexing assumptions built on the fact that only 
  // one workout is created.
  createNewWorkout(date) {
    this.state.workoutHandler.addEmptyWorkout(date, (displayWorkouts, newWorkoutIds) => {
      const newState = {workouts: displayWorkouts};
      // Clicking the "add workout" button won't trigger the opening of the AWM.
      // The AWM is opened here once the workout has been created in DB.
      newState.addWorkoutModuleConfig = { ...this.state.addWorkoutModuleConfig};
      newState.addWorkoutModuleConfig.workoutId = newWorkoutIds[0];
      newState.addWorkoutModuleConfig.showingAddWorkoutModule = true;
      this.setState(newState);
    });
  }

  toggleAddWorkoutModule(date="", id="") {
    let newState = {
      showingAddWorkoutModule: !this.state.addWorkoutModuleConfig.showingAddWorkoutModule
    };
    
    // If date is given, we're opening the module, and must populate the payload.
    if (date !== "") {
      // If no ID, we're creating a new workout.
      // Trigger the creation first on DB first, then populate the module with the resulting (empty) payload.
      if (id === "" ) {
        // this.updateDayContent(id, this.state.workoutHandler.generateEmptyPayload(date));
        this.createNewWorkout(date);
        // Don't update AWMC state to show the module yet -- wait for object to be created in DB and FE to update.
        // The createNewWorkout function will set AWMC to show.
      } else {
        newState.workoutId = id;
        newState.showingAddWorkoutModule = true; // Override in case the module is already open and a new date is selected
        this.setState({addWorkoutModuleConfig: newState});
      };
    };
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
    const addWorkoutModuleConfig = this.state.addWorkoutModuleConfig;

    let newWorkoutModulePayload;
    if (this.state.addWorkoutModuleConfig.showingAddWorkoutModule 
      && this.state.addWorkoutModuleConfig.workoutId !== "") {
        // Showing existing workout
      newWorkoutModulePayload = this.state.workoutHandler.getWorkoutById(addWorkoutModuleConfig.workoutId);
    };
    // Need failure case

    const content =         
      <div style={{display: "flex"}}>
          <NewWorkoutModule
            show={addWorkoutModuleConfig.showingAddWorkoutModule}
            onClose={() => this.toggleAddWorkoutModule("", "")}
            updateDayContentFunc={(workoutId, content) => this.updateDayContent(workoutId, content)}
            payload={newWorkoutModulePayload}
            id={addWorkoutModuleConfig.workoutId}
          />
        <div style={{flex: "1"}}>
          <Calendar 
            currentMonth={currentMonth.getMonthInfo()}
            decrementMonthHandler={() => this.decrementMonth()}
            incrementMonthHandler={() => this.incrementMonth()} 
            addNewWorkoutHandler={(date, id) => this.toggleAddWorkoutModule(date, id)}
            workouts={this.state.workouts}
            // updateDayContentFunc={(workoutId, content) => this.updateDayContent(workoutId, content)}
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
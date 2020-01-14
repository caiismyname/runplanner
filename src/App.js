import React from 'react';
import './App.css';
import { BrowserRouter as Router, Route } from 'react-router-dom';
import axios from 'axios';

import {UserContext} from './user-context';
import NewWorkoutModule from './NewWorkoutModal';
import Calendar from "./CalendarDisplay";

var moment = require('moment-timezone');

const serverDateFormat = "YYYY-MM-DD";
const dbAddress = "http://localhost:4000/runplannerDB/";
const defaultView = {
  CALENDAR: "calendar",
  COUNTDOWN: "countdown",
};

function isEmptyObject(obj) {
  return Object.entries(obj).length === 0 && obj.constructor === Object;
}

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
    return monthInfo.month + "-" + monthInfo.totalDisplayedDays;
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
  constructor(ownerID = "", mainTimezone = "") {
    this.ownerID = ownerID;
    this.workouts = {}; // Key = MongoID, Value = workout details
    this.dates = {}; // Key = date, Value = MongID (to use as reference into above dict)
    this.modified = [];
    this.mainTimezone = mainTimezone;
  }

  setOwnerID(id) {
    this.ownerID = id;
  }

  setMainTimezone(timezone) {
    this.mainTimezone = timezone;
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
    });
  }

  // no date changes for now TODO add date changes
  updateWorkout(id, payload, callback) {
    // "Modified" workouts are workouts that have already been pushed to DB.
    if (id !== "") {
      this.workouts[id] = payload;
      if (!(this.modified.includes(id))) {
        this.modified.push(id);
      };
      callback(this.generateDisplayWorkouts());
    } else { 
        this.addWorkout(payload, callback);
    }
  }

  addWorkout(payload, callback) {
    const date = moment(payload.date).format(serverDateFormat);
    // Wrapping in a list in case this supports multiple workouts in one call in the future.
    const workoutsToAdd = [{
      owner: this.ownerID,
      payload: payload,
    }];

    axios.post(dbAddress + "addworkouts", {"toAdd": workoutsToAdd})
    .then(res => {
      console.log(res.data);
      const newWorkoutId = res.data.id;
      this.workouts[newWorkoutId] = payload;
      if (date in this.dates) {
        this.dates[date].push(newWorkoutId);
      } else {
        this.dates[date] = [newWorkoutId];
      };
      
      callback(this.generateDisplayWorkouts(), newWorkoutId);
    });
  }

  syncToDB(callback) {
    // TODO do these still need to be deduped?
    const modified = [...new Set(this.modified)]; // Dedup the list
    const workoutsToUpdate = modified.map(x => {
      let res = {};
      res.payload = this.workouts[x];
      res.owner = this.ownerID;
      res.id = x;
      return res;
    });
    
    if (workoutsToUpdate.length > 0) {
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
      + this.ownerID + "/" 
      + startDate + "/"
      + endDate)
      .then(response => {
        if (response) {
          response.data.forEach(workout => {
          // Current choice is to always overwrite local info with DB info if conflict exists. 
            this.workouts[workout.id] = workout.payload;
            
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

    this.state = {
      currentMonth: new MonthHandler(),
      workoutHandler: new WorkoutHandler(),
      workouts: {},
      // ownerID: "5ded9ddfb2e5872a93e21989", // TODO mocking
      // ownerID: "",
      // name: "",
      defaultView: defaultView.CALENDAR,
      mainTimezone: "America/Los_Angeles",
      startingDayOfWeek: 0,
      countdownConfig: {
        deadline: moment().format(serverDateFormat)
      },
      addWorkoutModuleConfig: {
        showingAddWorkoutModule: false,
        workoutId: "",
        workoutDate: "",
      }
    }
  }

  componentDidMount() {
    this.state.workoutHandler.setOwnerID(this.context.ownerID);
    this.state.workoutHandler.setMainTimezone(this.state.mainTimezone);
    this.populateUser(this.populateWorkouts.bind(this));
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

  populateUser(callback) {
    axios.get(dbAddress + "getuser/" + this.context.ownerID)
      .then(response => {
        this.setState({
          // "name": response.data.name,
          "defaultView": response.data.config.default_view,
          "mainTimezone": response.data.config.mainTimezone,
          "countdownConfig": response.data.countdownConfig,
          "startingDayOfWeek": response.data.config.startingDayOfWeek,
        });
        
        // Callback used to ensure config data is in place before populating workouts
        callback();
      })
  }

  populateWorkouts() {
    let startDate;
    let endDate;
    if (this.props.defaultView === defaultView.CALENDAR) {
      startDate = this.state.currentMonth.getMonthStart();
      endDate = this.state.currentMonth.getMonthEnd()
    } else { // Countdown mode
      startDate = moment().format(serverDateFormat);
      endDate = this.state.countdownConfig.deadline;
    }

    this.state.workoutHandler.pullWorkoutsFromDB(startDate, endDate, (workouts) => this.setState({workouts: workouts}));
  }
  
  updateDayContent(id, payload) {
    this.state.workoutHandler.updateWorkout(id, payload, (workouts, newWorkoutId = "") => {
      const newState = {workouts: workouts};
      if (newWorkoutId !== "") {
        // Clicking the "add workout" button won't trigger the opening of the AWM.
        // The AWM is opened here once the workout has been created in DB.
        newState.addWorkoutModuleConfig = { ...this.state.addWorkoutModuleConfig};
        newState.addWorkoutModuleConfig.workoutId = newWorkoutId;
        newState.addWorkoutModuleConfig.showingAddWorkoutModule = true;
      }
      this.setState(newState);
    });
  }

  updateDB() {
    this.state.workoutHandler.syncToDB(workouts => this.setState({workouts: workouts}));
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
        this.updateDayContent(id, this.state.workoutHandler.generateEmptyPayload(date));
        // Don't update AWMC state to show the module yet -- wait for object to be created in DB and FE to update.
        // The update function will set AWMC to show.
      } else {
        newState.workoutId = id;
        newState.showingAddWorkoutModule = true; // Override in case the module is already open and a new date is selected
        this.setState({addWorkoutModuleConfig: newState});
      };
    };
  }
  
  render() {
    const currentMonth = this.state.currentMonth;
    const alternateDisplayMode = this.state.defaultView === defaultView.CALENDAR ? defaultView.COUNTDOWN : defaultView.CALENDAR;
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
            updateDayContentFunc={(workoutId, content) => this.updateDayContent(workoutId, content)}
            deadline={this.state.countdownConfig.deadline}
            defaultView={this.state.defaultView}
            startingDayOfWeek={this.state.startingDayOfWeek}
          />
        </div>
      </div>;

    return (
      <div>
        <h1>{"Hi " + this.context.ownerName + "!"}</h1>
        <button onClick={() => this.switchDisplayModes()}>{"Switch to " + alternateDisplayMode + " mode"}</button>
        <button onClick={() => this.updateDB()}>Save Edits</button>
        {content}
      </div>
    );
  }
}

MainPanel.contextType = UserContext;
  
function App() {
  return (
    <Router>
      <Route path="/" exact component={MainPanel}/>
    </Router>
  );
}

export default App;

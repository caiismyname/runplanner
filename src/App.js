import React from 'react';
import './App.css';
import { BrowserRouter as Router, Route } from "react-router-dom";
import axios from "axios";

import NewWorkoutModule from "./NewWorkoutModal";
import Calendar from "./CalendarDisplay";

var moment = require('moment-timezone');

let serverDateFormat = "YYYY-MM-DD";
let dbAddress = "http://localhost:4000/runplannerDB/";
let defaultView = {
  CALENDAR: "calendar",
  COUNTDOWN: "countdown",
};
let defaultStartTime = {hour: 7, minute: 0}; // 24 hour time

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
  constructor(ownerID = "") {
    this.ownerID = ownerID;
    this.workouts = {}; // Key = MongoID, Value = workout details
    this.dates = {}; // Key = date, Value = MongID (to use as reference into above dict)
    this.modified = [];
    this.newWorkouts = [];
  }

  setOwnerID(id) {
    this.ownerID = id;
  }

  // no date changes for now TODO add date changes
  updateWorkout(id, payload, callback) {
    if (id !== "" && !(this.newWorkouts.includes(id))) {
      this.workouts[id].payload = payload;
      this.modified.push(id);
      callback(this.generateDisplayWorkouts());
    } else { // For new workouts, there is no id
        this.addWorkout(payload, callback);
    }
  }

  addWorkout(payload, callback) {
    const date = moment(payload.date).format(serverDateFormat);
    const tempId = date; // I understand its redundant, but it clarifies the use of the date in the "ID" context below.

    if (tempId in this.workouts) {
      const old = this.workouts[tempId].payload;
      const mergedPayload = {};
      Object.keys(payload).forEach(k => {
        mergedPayload[k] = payload[k] === "" ? old[k] : payload[k];
      });
      this.workouts[tempId] = {payload: mergedPayload};
    } else {
      this.workouts[tempId] = {payload: payload};
    }
    
    this.dates[date] = tempId; 
    this.newWorkouts.push(tempId);

    callback(this.generateDisplayWorkouts());
  }

  syncToDB(callback) {
    const modified = [...new Set(this.modified)]; // Dedup the list
    const newWorkouts = [...new Set(this.newWorkouts)]; // Dedup the list
    let workoutsToUpdate = modified.map(x => {
      let res = JSON.parse(JSON.stringify(this.workouts[x]));
      res.id = x;
      res.owner = this.ownerID;
      return res;
    });
    let workoutsToAdd = newWorkouts.map(x => {
      return {
        owner: this.ownerID,
        payload: this.workouts[x].payload,
      }
    });
    
    if (workoutsToUpdate.length > 0) {
      axios.post(dbAddress + "updateworkouts", {"toUpdate": workoutsToUpdate})
        .then(res => {
          console.log(res.data);
          this.modified = [];
          callback(this.generateDisplayWorkouts());
        });
    }
   
    if (workoutsToAdd.length > 0) {
      axios.post(dbAddress + "addworkouts", {"toAdd": workoutsToAdd})
      .then(res => {
        console.log(res.data);
        this.newWorkouts = [];
        callback(this.generateDisplayWorkouts());
      });
    }

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
            this.workouts[workout.id] = {
              payload: workout.payload,
            }
            
            const formattedDate = moment(workout.payload.date).format(serverDateFormat);
            this.dates[formattedDate] = workout.id;
          });
          callback(this.generateDisplayWorkouts());
        }
      });
  }

  generateDisplayWorkouts() {
    let res = {};
    Object.keys(this.dates).forEach((key,idx) => {
      res[key] = {
        payload: this.workouts[this.dates[key]].payload,
        id: this.dates[key],
      }
    });

    return res;
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
      ownerID: "5ded9ddfb2e5872a93e21989", // TODO mocking
      name: "",
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
    this.state.workoutHandler.setOwnerID(this.state.ownerID);
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
    axios.get(dbAddress + "getuser/" + this.state.ownerID)
      .then(response => {
        this.setState({
          "name": response.data.name,
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
    this.state.workoutHandler.updateWorkout(id, payload, workouts => {
      this.setState({workouts: workouts});
    });
  }

  updateDB() {
    this.state.workoutHandler.syncToDB(workouts => this.setState({workouts: workouts}));
  }

  toggleAddWorkoutModule(date="", id="") {
    let newState = {
      showingAddWorkoutModule: !this.state.addWorkoutModuleConfig.showingAddWorkoutModule
    }
    
    // If date is given, we're opening the module, and must populate the payload
    if (date !== "") {
      newState["workoutDate"] = date;
      newState["workoutId"] = id;
    }

    this.setState({addWorkoutModuleConfig: newState});
  }
  
  render() {
    const currentMonth = this.state.currentMonth;
    const alternateDisplayMode = this.state.defaultView === defaultView.CALENDAR ? defaultView.COUNTDOWN : defaultView.CALENDAR;
    const addWorkoutModuleConfig = this.state.addWorkoutModuleConfig;

    let newWorkoutModulePayload;
    if (this.state.workouts[addWorkoutModuleConfig.workoutDate]) {
      // TODO remove the layer of 'payload' from the 'workouts' obj
      newWorkoutModulePayload = this.state.workouts[addWorkoutModuleConfig.workoutDate].payload;
    } else {
      let date = moment(addWorkoutModuleConfig.workoutDate);
      date.hour(defaultStartTime.hour);
      date.minute(defaultStartTime.minute);
      date = moment.tz(date, this.state.mainTimezone);
      
      newWorkoutModulePayload = {
        date: date.toISOString(),
      };
    }

    const content =         
      <div style={{display: "flex"}}>
          <NewWorkoutModule
            show={addWorkoutModuleConfig.showingAddWorkoutModule}
            onClose={this.toggleAddWorkoutModule}
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
        <h1>{"Hi " + this.state.name + "!"}</h1>
        <button onClick={() => this.switchDisplayModes()}>{"Switch to " + alternateDisplayMode + " mode"}</button>
        <button onClick={() => this.updateDB()}>Save Edits</button>
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

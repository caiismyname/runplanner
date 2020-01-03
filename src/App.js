import React from 'react';
import './App.css';
import moment from 'moment';
import { BrowserRouter as Router, Route } from "react-router-dom";
import axios from "axios";
import NewWorkoutModule from "./NewWorkoutModal";

import plus_icon from './plus_icon.png';

let serverDateFormat = "YYYY-MM-DD";
let dbAddress = "http://localhost:4000/runplannerDB/";

let defaultView = {
  CALENDAR: "calendar",
  COUNTDOWN: "countdown",
}

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

  // TODO move this into calendar object
  generateHeaderDayLabels() {
    let daysOfWeek = [];
    let dayFormatting = "ddd"; // ddd = Mon | dddd = Monday 
    for (let i = 0; i < 14; i++) {
      // Order: Sun --> Sat
      daysOfWeek.push(moment().day(i % 7).format(dayFormatting));
    }
    daysOfWeek = daysOfWeek.slice(this.state.startingDayOfWeek, this.state.startingDayOfWeek + 7);

    const dayLabels = daysOfWeek.map((value, index) => {
      return (<span key={value}><h1>{value}</h1></span>);
    });

    return dayLabels;
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

    const content =         
      <div style={{display: "flex"}}>
          <NewWorkoutModule
            show={addWorkoutModuleConfig.showingAddWorkoutModule}
            onClose={this.toggleAddWorkoutModule}
            updateDayContentFunc={(workoutId, content) => this.updateDayContent(workoutId, content)}
            payload={
              this.state.workouts[addWorkoutModuleConfig.workoutDate] 
              ? this.state.workouts[addWorkoutModuleConfig.workoutDate].payload 
              : {date: addWorkoutModuleConfig.workoutDate}}
            id={addWorkoutModuleConfig.workoutId}
          />
        <div style={{flex: "1"}}>
          <div className="dayLabels">
            {this.generateHeaderDayLabels()}
          </div>
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

class Calendar extends React.Component {
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
      const payload = typeof this.props.workouts[date] !== 'undefined' ? this.props.workouts[date].payload : null;
      const id = typeof this.props.workouts[date] !== 'undefined' ? this.props.workouts[date].id : null;
      dayArray.splice(i, 1, {
        date: date,
        payload: payload,
        id: id,
      });

      currentDay.add(1, "day");
    } 

    return dayArray;
  }

  render() {
    // Split days into weeks
    const dayArray = this.fillDayArray();
    const weeks = [];

    for (let i = 0; i < dayArray.length; i += 7) {
      weeks.push(dayArray.slice(i, i + 7));
    }

    const weekElements = weeks.map((value, index) => {
      return (
        <div key={index.toString()}>
          <WeekDisplay 
            days={value} 
            updateDayContentFunc={(workoutId, content) => this.props.updateDayContentFunc(workoutId, content)}
            addNewWorkoutHandler={(date, id) => this.props.addNewWorkoutHandler(date, id)}
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
        {weekElements}
      </div>
    );
    
  }
}

class CalendarMonthControl extends React.Component {
  render() {

    return (
      <div>
        <h1>{moment(this.props.currentMonth.month).format("MMMM YYYY")}</h1>
        <div>
          <button onClick={() => this.props.decrementMonthHandler()}>{"<"}</button>
          <button onClick={() => this.props.incrementMonthHandler()}>{">"}</button>
        </div>
      </div>
    );
  }
}

class WeekDisplay extends React.Component {
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
            payload={value.payload ? value.payload : {"content": "", "type": "", "date": ""}} 
            id={value.id ? value.id : ""}
            updateDayContentFunc={(date, content) => this.props.updateDayContentFunc(date, content)}
            addNewWorkoutHandler={(date, id) => this.props.addNewWorkoutHandler(date, id)}
          />
        </div>
      );
    });

    return (
      <div className="weekDisplay">
        {dayCells}
      </div>
    );
  }
}

class DayCell extends React.Component {
  generateDisplayDate() {
    if (this.props.date === "") {
      return null;
    }
    return moment(this.props.date).format("M/DD/YY");
  }
  
  render() {
    let content;
    if (this.props.payload.type !== "" && this.props.payload.content !== "") {
      content =  (
        <div style={{border: "1px solid green"}} onClick={() => this.props.addNewWorkoutHandler(this.props.date, this.props.id)}>
          <h3>{this.props.payload.type}</h3>
          <p>{this.props.payload.content}</p>

        </div>
      );
    } else {
      content = (
        <div>
          <img 
            src={plus_icon} 
            alt="Add new workout" 
            style={{width: "34%", margin: "auto", display: "block"}}
            onClick={() => this.props.addNewWorkoutHandler(this.props.date, this.props.id)}
          />
        </div>
      );
    }

    return (
      <div>
        <h2>{this.generateDisplayDate()}</h2>
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

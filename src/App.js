import React from 'react';
import './App.css';
import moment from 'moment';
import { BrowserRouter as Router, Route } from "react-router-dom";
import axios from "axios";

let serverDateFormat = "YYYY-MM-DD";
let dbAddress = "http://localhost:4000/runplannerDB/";

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

    this.state = {
      currentMonth: new MonthHandler(),
      workoutHandler: new WorkoutHandler(),
      workouts: {},
      ownerID: "5dfafd7e2580e663969653c0", // TODO mocking
      name: "",
      isCalendarMode: false, // TODO reconcile this with the DB format (enum)
      startingDayOfWeek: 0,
      countdownConfig: {
        deadline: moment().format(serverDateFormat)
      },
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
    this.setState({isCalendarMode: !this.state.isCalendarMode});
  }

  populateUser(callback) {
    axios.get(dbAddress + "getuser/" + this.state.ownerID)
      .then(response => {
        this.setState({
          "name": response.data.name,
          "isCalendarMode": response.data.config.default_view === "calendar",
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
    if (this.state.isCalendarMode) {
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
  
  render() {
    const currentMonth = this.state.currentMonth;
    const alternateDisplayMode = this.state.isCalendarMode ? "countdown" : "calendar";

    let content =         
      <div>
        <Calendar 
          currentMonth={currentMonth.getMonthInfo()}
          decrementMonthHandler={() => this.decrementMonth()}
          incrementMonthHandler={() => this.incrementMonth()}  
          workouts={this.state.workouts}
          updateDayContentFunc={(workoutId, content) => this.updateDayContent(workoutId, content)}
          deadline={this.state.countdownConfig.deadline}
          isCalendarMode={this.state.isCalendarMode}
          startingDayOfWeek={this.state.startingDayOfWeek}
        />
      </div>;

    return (
      <div>
        <h1>{"Hi " + this.state.name + "!"}</h1>
        <button onClick={() => this.switchDisplayModes()}>{"Switch to " + alternateDisplayMode + " mode"}</button>
        <div className="dayLabels">
          {this.generateHeaderDayLabels()}
        </div>
        <button onClick={() => this.updateDB()}><h2>Save</h2></button>
        {content}
      </div>
    );
  }
}

class Calendar extends React.Component {
  fillDayArray() {
    let totalDays;
    let fullArrayLength;
    let startingDayOfWeek;
    let month;
    
    if (this.props.isCalendarMode) {
      fullArrayLength = 42; // 6 weeks * 7 days in a week. One month can span 6 weeks at maximum.
      startingDayOfWeek = this.props.currentMonth.startingDayOfWeek;
      totalDays = this.props.currentMonth.totalDays;
      month = this.props.currentMonth.month;
    } else {
      startingDayOfWeek = this.props.startingDayOfWeek;
      // This was Victor's version of the below, where A is the start of week and B is "today": abs(min((B-(A-7))*sgn(B-A), abs(B-A))
      let todayDayOfWeek = Number(moment().format("d"));
      let daysToStartOfWeek = startingDayOfWeek <= todayDayOfWeek 
                                ? todayDayOfWeek - startingDayOfWeek 
                                : (7 - startingDayOfWeek) + todayDayOfWeek;
      
      const startOfWeek = moment().subtract(daysToStartOfWeek, "days");
      // param deadline is a string, turning it into a moment object here
      const deadlineObj = moment(this.props.deadline);
      // + 1 b/c we want to include the deadline day, 
      totalDays = Math.ceil(moment.duration(deadlineObj.diff(startOfWeek)).asDays()) + 1;
      // Pad the end of array if the deadline date is not the end of the week (as displayed);
      fullArrayLength = totalDays + (totalDays % 7 === 0 ? 0 : 7 - totalDays % 7); 
      month = moment().format(serverDateFormat);
    }
    
    let dayArray = Array(fullArrayLength).fill({}); 
     // Prefill with given month since calendar doesn't necessarily reflect the current month.
    const currentDay = moment(month);
    for (let i = startingDayOfWeek; i < startingDayOfWeek + totalDays; i++) {
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

    // Filling the array to 6 weeks is the maximum case, but most months don't span 6 calendar weeks.
    // If the month only needs 5 weeks, remove the last (empty) week.
    if (this.props.isCalendarMode && dayArray.slice(fullArrayLength - 7, fullArrayLength).every(elem => elem === null)) {
      dayArray = dayArray.slice(0, fullArrayLength - 7);
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
          <WeekDisplay days={value} updateDayContentFunc={(workoutId, content) => this.props.updateDayContentFunc(workoutId, content)}/>
        </div>
      );
    });

    return (
      <div>
        {this.props.isCalendarMode ? 
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
  constructor(props) {
    super(props);

    this.handleWorkoutContentChange = this.handleWorkoutContentChange.bind(this);
    this.handleWorkoutTypeChange = this.handleWorkoutTypeChange.bind(this);
  }

  timeSetter(timeString) {
    // TODO I have no idea how to address timezones. THis is a problem for later.
    let time = moment(timeString);
    time.hour(8);
    time.minute(0);
    return time;
  }
  
  handleWorkoutContentChange(event) {
    const newPayload = {
      type: this.props.payload.type,
      content: event.target.value,
      date: this.props.id === "" ? this.timeSetter(this.props.date).toISOString() : this.props.payload.date,
    }
    this.props.updateDayContentFunc(this.props.id, newPayload);
  }

  handleWorkoutTypeChange(event) {
    const newPayload = {
      type: event.target.value,
      content: this.props.payload.content,
      date: this.props.id === "" ? this.timeSetter(this.props.date).toISOString() : this.props.payload.date,
    }

    this.props.updateDayContentFunc(this.props.id, newPayload);
  }

  generateDisplayDate() {
    if (this.props.date === "") {
      return null;
    }
    return moment(this.props.date).format("M/DD/YY");
  }

  render() {
    let contentField;
    // if (this.props.payload.content) {
    //   contentField = <textarea value={this.props.payload.content} onChange={this.handleWorkoutContentChange}/>;
    // } else {
    //   // Prevents displaying an empty text box on empty days
    //   contentField = null;
    // }
    contentField = <textarea value={this.props.payload.content} onChange={this.handleWorkoutContentChange}/>;

    return (
      <div>
        <h2>{this.generateDisplayDate()}</h2>
        <textarea value={this.props.payload.type} onChange={this.handleWorkoutTypeChange}/> {/* don't forget to style this lol*/}
        {contentField}
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

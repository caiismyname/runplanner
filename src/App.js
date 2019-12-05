import React from 'react';
import './App.css';
import moment from 'moment';
import { BrowserRouter as Router, Route, Link } from "react-router-dom";
// import axios from "axios";

class MonthHandler {
  // Defaults to current month if none is given
  constructor(now = moment()) {
    this.currentMonth = now; // MomentJS's months are 0 indexed
  }

  getFormattedMonth() {
    return this.currentMonth.format("YYYY-MM"); 
  }

  numberOfDaysInMonth(month, year) { 
    // Source: https://www.geeksforgeeks.org/how-to-get-the-number-of-days-in-a-specified-month-using-javascript/
    return new Date(year, month, 0).getDate(); 
  }

  startingDayOfWeek(month, year) {
    return new Date(month + "-01-" + year).getDay(); // Fucking American date formatting, not ISO
  }

  getMonthInfo() {
    const now = this.currentMonth; // Moment's months are 0 indexed (0 is January)
    return ({
      totalDays: this.numberOfDaysInMonth(now.month() + 1, now.year()),
      startingDayOfWeek: this.startingDayOfWeek(now.month() + 1, now.year()), // 0 is Sunday
      month: now.format("YYYY-MM"),
    });
  }

  incrementMonth() {
    return new MonthHandler(this.currentMonth.add(1, "month"));
  }

  decrementMonth() {
    return new MonthHandler(this.currentMonth.subtract(1, "month"));
  }
}

class MainPanel extends React.Component {
  constructor(props) {
    super(props);

    const deadlineDate = "2019-12-22"; // TODO mocking data for now. 

    this.state = {
      currentMonth: new MonthHandler(),
      isCalendarMode: false,
      countdownDeadline: moment(deadlineDate),
      workouts: {
        "2019-11-0" : {
          type: "Example",
          content: "THis is sample content",
        }
      }
    }
  }

  decrementMonth() {
    this.setState({currentMonth: this.state.currentMonth.decrementMonth()});
  }

  incrementMonth() {
    this.setState({currentMonth: this.state.currentMonth.incrementMonth()});
  } 

  switchDisplayModes() {
    this.setState({isCalendarMode: !this.state.isCalendarMode});
  }

  getDayContent(date) {
    if (date in this.state.workouts) {
      return this.state.workouts[date];
    }
    return {
      type: "Recovery",
      content: "Run " + moment(date).format("D") + " miles",
    }
  }

  updateDayContent(date, content) {
    // TODO this is mock implementation, to test the state updating methods down to daycellContent level
    const workouts = this.state.workouts;
    workouts[date] = content;
    this.setState(
      {workouts: workouts}
    )
  }

  generateHeaderDayLabels() {
    let daysOfWeek = [];
    let dayFormatting = "ddd"; // ddd = Mon | dddd = Monday 
    for (let i = 0; i < 7; i++) {
      // You know. In case they change the name of Monday or something.
      daysOfWeek.push(moment().day(i).format(dayFormatting));
    }
    if (this.props.startsOnMonday) {
      daysOfWeek = daysOfWeek.slice(1).concat(daysOfWeek[0]);
    }
    const dayLabels = daysOfWeek.map((value, index) => {
      return (<span key={value}><h1>{value}</h1></span>);
    });

    return dayLabels;
  }
  
  render() {
    const currentMonth = this.state.currentMonth;
    const alternateDisplayMode = this.state.isCalendarMode ? "countdown" : "calendar";

    let content;
    if (this.state.isCalendarMode) {
      content =         
        <div>
          <Calendar 
            currentMonth={currentMonth.getMonthInfo()}
            decrementMonthHandler={() => this.decrementMonth()}
            incrementMonthHandler={() => this.incrementMonth()}  
            getDayContentFunc={(date) => this.getDayContent(date)}
            updateDayContentFunc={(date, content) => this.updateDayContent(date, content)}
          />
        </div>;
    } else {
      content = 
        <div>
          <CountdownView 
            deadline={this.state.countdownDeadline}
            getDayContentFunc={(date) => this.getDayContent(date)}
            updateDayContentFunc={(date, content) => this.updateDayContent(date, content)}
          />
        </div>;
    }

    return (
      <div>
        <button onClick={() => this.switchDisplayModes()}>{"Switch to " + alternateDisplayMode + " mode"}</button>
        <div className="dayLabels">
          {this.generateHeaderDayLabels()}
        </div>
        {content}
      </div>
    );
  }
}

class CountdownView extends React.Component {
  fillDayArray(deadline) {
    const startingDayOfWeek = Number(moment().format("d"));
    // + 1 b/c we want to include the deadline day, + startingDayOfWeek because right now we cut off the days that have already passed.
    // TODO show the full current week.
    const daysUntilDeadline = Math.ceil(moment.duration(deadline.diff(moment())).asDays()) + 1 + startingDayOfWeek;
    // Pad the end of array if the deadline date is not the end of the week (as displayed);
    const fullArrayLength = daysUntilDeadline + (daysUntilDeadline % 7 == 0 ? 0 : 7 - daysUntilDeadline % 7); 
    const dayArray = Array(fullArrayLength).fill(null);

    const currentDay = moment(); // This will keep track of what day the ith day is in the loop below. Used for getting the actual date.
    for (let i = startingDayOfWeek; i < daysUntilDeadline; i++) {
      const date = currentDay.format("YYYY-MM-D");
      const workoutDetails = this.props.getDayContentFunc(date);
      currentDay.add(1, "day");

      dayArray.splice(i, 1, {
        date: date,
        workoutDetails: workoutDetails,
      });
    }

    return dayArray;
  }
  
  render() {
    // Split days into weeks
    const dayArray = this.fillDayArray(this.props.deadline);
    const weeks = [];

    for (let i = 0; i < dayArray.length; i += 7) {
      weeks.push(dayArray.slice(i, i + 7));
    }

    const weekElements = weeks.map((value, index) => {
      return (
        <div key={index.toString()}>
          <WeekDisplay days={value} updateDayContentFunc={(date, content) => this.props.updateDayContentFunc(date, content)}/>
        </div>
      );
    });

    return (
      <div>
        <h1>{"Countdown Mode!"}</h1>
        {weekElements}
      </div>
    );
  }
}

class Calendar extends React.Component {
  fillDayArray() {
    const fullArrayLength = 42; // 6 weeks * 7 days in a week. One month can span 6 weeks at maximum.
    const startingDayOfWeek = this.props.currentMonth.startingDayOfWeek;
    const totalDays = this.props.currentMonth.totalDays;
    const month = this.props.currentMonth.month;

    let dayArray = Array(fullArrayLength).fill(null); 
    const currentDay = moment(month); // Prefill with given month since calendar doesn't necessarily reflect the current month.
    for (let i = startingDayOfWeek; i < startingDayOfWeek + totalDays; i++) {
      const date = currentDay.format("YYYY-MM-D");
      const workoutDetails = this.props.getDayContentFunc(date);
      dayArray.splice(i, 1, {
        date: date,
        workoutDetails: workoutDetails,
      });

      currentDay.add(1, "day");
    } 

    // Filling the array to 6 weeks is the maximum case, but most months don't span 6 calendar weeks.
    // If the month only needs 5 weeks, remove the last (empty) week.
    if (dayArray.slice(fullArrayLength - 7, fullArrayLength).every(elem => elem === null)) {
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
          <WeekDisplay days={value} updateDayContentFunc={(date, content) => this.props.updateDayContentFunc(date, content)}/>
        </div>
      );
    });


    return (
      <div>
        <CalendarMonthControl 
          currentMonth={this.props.currentMonth}
          decrementMonthHandler={() => this.props.decrementMonthHandler()}
          incrementMonthHandler={() => this.props.incrementMonthHandler()}
        />
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
  constructor(props) {
    super(props);

  }

  render() {
    const days = this.props.days.slice()
    const dayCells = days.map((value, index) => {
      return (
        <div className="dayCell" key={index}>
          <DayCell 
            date={value ? value.date : null}
            workoutDetails={value ? value.workoutDetails : {}} // apparently reading properties from an empty object doesn't fail?
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
  
  handleWorkoutContentChange(event) {
    const newContent = {
      type: this.props.workoutDetails.type,
      content: event.target.value,
    }
    this.props.updateDayContentFunc(this.props.date, newContent);
  }

  handleWorkoutTypeChange(event) {
    const newContent = {
      type: event.target.value,
      content: this.props.workoutDetails.content,
    }
    this.props.updateDayContentFunc(this.props.date, newContent);
  }

  generateDisplayDate() {
    if (!this.props.date) {
      return null;
    }
    return moment(this.props.date).format("M/DD/YY");
  }

  render() {
    let contentField;
    if (this.props.workoutDetails.content) {
      contentField = <textarea value={this.props.workoutDetails.content} onChange={this.handleWorkoutContentChange}/>;
    } else {
      // Prevents displaying an empty text box on empty days
      contentField = null;
    }

    return (
      <div>
        <h2>{this.generateDisplayDate()}</h2>
        <textarea value={this.props.workoutDetails.type} onChange={this.handleWorkoutTypeChange}/> {/* don't forget to style this lol*/}
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

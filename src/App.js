import React from 'react';
import './App.css';
import moment from 'moment';

class MonthHandler {
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
      name: now.format("MMMM"),
      totalDays: this.numberOfDaysInMonth(now.month() + 1, now.year()),
      startingDayOfWeek: this.startingDayOfWeek(now.month() + 1, now.year()), // 0 is Sunday
      datePrefix: now.format("YYYY-MM"),
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

    this.state = {
      currentMonth: new MonthHandler(),
    }
  }

  decrementMonth() {
    this.setState({currentMonth: this.state.currentMonth.decrementMonth()});
  }

  incrementMonth() {
    this.setState({currentMonth: this.state.currentMonth.incrementMonth()});
  } 
  
  render() {
    const currentMonth = this.state.currentMonth;
    return (
      <div>
        <MonthControl 
          currentMonth={currentMonth.getMonthInfo()}
          decrementMonthHandler={() => this.decrementMonth()}
          incrementMonthHandler={() => this.incrementMonth()}
        />
        <Calendar currentMonth={currentMonth.getMonthInfo()}/>
      </div>
    );
  }
}

class MonthControl extends React.Component {
  constructor(props) {
    super(props);

  }

  render() {

    return (
      <div>
        <h1>{this.props.currentMonth.name + " " + moment(this.props.currentMonth.datePrefix).format("YYYY")}</h1>
        <div>
          <button onClick={() => this.props.decrementMonthHandler()}>{"<"}</button>
          <button onClick={() => this.props.incrementMonthHandler()}>{">"}</button>
        </div>
      </div>
    );
  }
}

class Calendar extends React.Component {
  constructor(props) {
    super(props);
  }

  // TODO I'm not convinced this is the right level to populate the workout info.
  getWorkoutDetails(date) {
    return {
      workoutType: "Recovery",
      content: "20 miles \n 1 mile rest \n 3 miles tempo \n cooldown",
    }
  }

  fillDayArray() {
    const fullArrayLength = 42;
    const startingDayOfWeek = this.props.currentMonth.startingDayOfWeek;
    const totalDays = this.props.currentMonth.totalDays;
    const datePrefix = this.props.currentMonth.datePrefix;

    let dayArray = Array(fullArrayLength).fill(null); // One month can span 6 weeks at maximum.
    for (let i = startingDayOfWeek; i < startingDayOfWeek + totalDays; i++) {
      const dayOfMonth = i - startingDayOfWeek + 1;
      const date = datePrefix + "-" + dayOfMonth.toString(); // Format: YYYY-MM-D
      const workoutDetails = this.getWorkoutDetails(date);
      dayArray.splice(i, 1, {
        date: date,
        dayOfMonth: dayOfMonth,
        workoutDetails: workoutDetails,
      });
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
          <WeekDisplay days={value}/>
        </div>
      );
    });

    // Generate day labels for header
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

    return (
      <div>
        <div className="dayLabels">
          {dayLabels}
        </div>
        {weekElements}
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
            dayOfMonth={value ? value.dayOfMonth : null}
            workoutDetails={value ? value.workoutDetails : {}} // apparently reading properties from an empty object doesn't fail?
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

  }

  render() {
    return (
      <div>
        <DayCellHeader 
          dayOfMonth={this.props.dayOfMonth}
          workoutType={this.props.workoutDetails.workoutType}
        />
        <DayCellContentField
          workoutContent={this.props.workoutDetails.content}
        />
      </div>
    );
  }
}

class DayCellHeader extends React.Component {
  render() {

    return (
      <span>
        <DayCellNumberDisplay dayOfMonth={this.props.dayOfMonth}/>
        <WorkoutTypeField workoutType={this.props.workoutType}/>
      </span>
    );
  }
}

class DayCellNumberDisplay extends React.Component {
  render() {

    return <h2>{this.props.dayOfMonth}</h2>;
  }
}

class WorkoutTypeField extends React.Component {
  render() {

    return <h3>{this.props.workoutType}</h3>;
  }
}

class DayCellContentField extends React.Component {
  constructor(props) {
    super(props);

  }
  
  render() {

    return <p>{this.props.workoutContent}</p>;
  }
}

function App() {
  return (
    <div className="App">
      <MainPanel />
    </div>
  );
}

export default App;

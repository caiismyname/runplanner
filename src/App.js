import React from 'react';
import './App.css';
import moment from 'moment';

class MonthHandler {
  constructor() {
    this.currentMonth = moment().add(0, 'month').format("YYYY-MM"); // MomentJS's months are 0 indexed
  }

  numberOfDaysInMonth(month, year) { 
    // Source: https://www.geeksforgeeks.org/how-to-get-the-number-of-days-in-a-specified-month-using-javascript/
    return new Date(year, month, 0).getDate(); 
  }

  startingDayOfWeek(month, year) {
    return new Date(month + "-01-" + year).getDay(); // Fucking American date formatting, not ISO
  }

  getMonthInfo() {
    const now = moment(this.currentMonth); // Moment's months are 0 indexed (0 is January)
    return ({
      name: now.format("MMMM"),
      totalDays: this.numberOfDaysInMonth(now.month() + 1, now.year()),
      startingDayOfWeek: this.startingDayOfWeek(now.month() + 1, now.year()), // 0 is Sunday
      datePrefix: now.format("YYYY-MM"),
    });
  }
}

class MainPanel extends React.Component {
  render() {
    const currentMonth = new MonthHandler();

    return (
      <div>
        <MonthControl currentMonth={currentMonth.getMonthInfo()}/>
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
      <h1>{this.props.currentMonth.name}</h1>
    );
  }
}

class Calendar extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      dayArray: (this.fillDayArray(
        props.currentMonth.startingDayOfWeek, 
        props.currentMonth.totalDays, 
        props.currentMonth.datePrefix)
      ),
    }
  }

  fillDayArray(startingDayOfWeek, totalDays, datePrefix) {
    const fullArrayLength = 42;
    let dayArray = Array(fullArrayLength).fill(null); // One month can span 6 weeks at maximum.
    for (let i = startingDayOfWeek; i < startingDayOfWeek + totalDays; i++) {
      const dayOfMonth = i - startingDayOfWeek + 1;
      dayArray.splice(i, 1, {
        date: datePrefix + "-" + dayOfMonth.toString(), // Format: YYYY-MM-D
        dayOfMonth: dayOfMonth
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
    const dayArray = this.state.dayArray.slice();
    let cells = dayArray.map((value, index) => {
      return (
        <div className="dayCell">
          <DayCell dayOfMonth={value ? value.dayOfMonth : null}/>
        </div>
      ); 
    })

    return (
      <div>
        {cells}
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
        <DayCellHeader dayOfMonth={this.props.dayOfMonth}/>
      </div>
    );
  }
}

class DayCellHeader extends React.Component {
  constructor(props) {
    super(props);

  }

  render() {

    return (
      <span>
        <DayCellNumberDisplay dayOfMonth={this.props.dayOfMonth}/>
        <RunTypeField />
      </span>
    );
  }
}

class DayCellNumberDisplay extends React.Component {
  render() {

    return <h2>{this.props.dayOfMonth}</h2>;
  }
}

class RunTypeField extends React.Component {
  render() {

    return null;
  }
}

class DayCellContentField extends React.Component {
  constructor(props) {
    super(props);

  }
  
  render() {

    return null;
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

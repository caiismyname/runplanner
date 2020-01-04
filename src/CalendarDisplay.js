import React from 'react';
import './App.css';
import plus_icon from './plus_icon.png';
var moment = require('moment-timezone');



let serverDateFormat = "YYYY-MM-DD";
let defaultView = {
    CALENDAR: "calendar",
    COUNTDOWN: "countdown",
  }
  
function isEmptyObject(obj) {
    return Object.entries(obj).length === 0 && obj.constructor === Object;
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

    generateHeaderDayLabels() {
        let daysOfWeek = [];
        let dayFormatting = "ddd"; // ddd = Mon | dddd = Monday 
        for (let i = 0; i < 14; i++) {
            // Order: Sun --> Sat
            daysOfWeek.push(moment().day(i % 7).format(dayFormatting));
        }
        daysOfWeek = daysOfWeek.slice(this.props.startingDayOfWeek, this.props.startingDayOfWeek + 7);

        const dayLabels = daysOfWeek.map((value, index) => {
            return (<div key={value}><h1>{value}</h1></div>);
        });

        return dayLabels;
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
          <div className="dayLabels">
            {this.generateHeaderDayLabels()}
          </div>
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
            <div 
                style={{border: "1px solid green"}} 
                onClick={() => this.props.addNewWorkoutHandler(this.props.date, this.props.id)}
            >
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


export default Calendar;
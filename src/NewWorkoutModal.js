// Credit to https://daveceddia.com/open-modal-in-react/

import React from 'react';
// import PropTypes from 'prop-types';
var moment = require('moment-timezone');

let workoutFields = {
  TYPE: "type",
  CONTENT: "content",
  DATE: "date",
};
let dateDisplayFormat = "M/DD/YY";

class NewWorkoutModule extends React.Component {
  constructor(props) {
    super(props);
    this.handleWorkoutChange = this.handleWorkoutChange.bind(this);
  }

  handleWorkoutChange(newValue, source) {
    let newPayload = { ...this.props.payload};
    console.log(source, newValue);
    newPayload[source] = newValue;

    // NOTE: If the empty `this.props.id` is passed to WorkoutHandler, the WorkoutHandler will auto assign the date+time as the temp ID
    this.props.updateDayContentFunc(this.props.id, newPayload);
  }

  render() {
    if(!this.props.show) {
      return null;
    }

    const modalStyle = {
      flex: "0 0 35%",
    };

    return (
      <div style={{modalStyle}}>
        <h1>{moment(this.props.payload.date).format(dateDisplayFormat)}</h1>
        <h2>Time</h2>
        <TimeEntry 
          date={this.props.payload.date}
          callback={(newDateTime) => {
            this.handleWorkoutChange(newDateTime, workoutFields.DATE);
          }}
        />

        <br/>
        <br/>
        <h2>Type</h2>
        <textarea value={this.props.payload.type} onChange={(e) => this.handleWorkoutChange(e.target.value, workoutFields.TYPE)}/>
        <br/>
        <br/>
        
        <h2>Content</h2>
        <textarea value={this.props.payload.content} onChange={(e) => this.handleWorkoutChange(e.target.value, workoutFields.CONTENT)}/>
        <div className="footer">
          <button onClick={this.props.onClose}>Close</button>
          <button>Delete</button>
        </div>
      </div>
    );
  }
}

class TimeEntry extends React.Component {
  constructor(props) {
    super(props);

    const displayTime = moment(props.date);
    const displayHour = displayTime.format("h");
    const displayMinute = displayTime.format("mm");
    const displayPeriod = displayTime.format("a");

    this.state = {
      hour: displayHour,
      minute: displayMinute,
      period: displayPeriod,
    };
  }

  generateNewDateTime() {
    const oldTime = moment(this.props.date);
    oldTime.hour(Number(this.state.hour) + (this.period === "pm"? 12 : 0));
    oldTime.minute(Number(this.state.minute));

    return oldTime.toISOString();
  }

  render() {
    return (
      <div style={{display: "inline"}}>
        <textarea 
          style={{float: "left", width: "2em", height: "1em", resize: "none"}} 
          value={this.state.hour}
          onChange={(e) => {
            const value = e.target.value.slice(0,2);
            if (Number(value) > 12) {
              return;
            } 
            this.setState({hour: value}, () => {
              this.props.callback(this.generateNewDateTime());
            });
          }}  
        />
        <textarea 
          style={{float: "left", width: "2em", height: "1em", resize: "none"}} 
          value={this.state.minute}
          onChange={(e) => {
            let value = e.target.value.slice(0,2);
            if (Number(value) > 59) {
              return;
            } 
            this.setState({minute: value}, () => {
              this.props.callback(this.generateNewDateTime());
            });
          }}
          onBlur={() => {
            // Pad single digit minutes with leading 0
            if (this.state.minute.length === 1) {
              this.setState({minute: "0" + this.state.minute});
            }
          }}
        />
        <button 
          style={{float: "left"}}
          onClick={() => {
            this.setState({period: this.state.period === "am" ? "pm" : "am"}, () => {
              this.props.callback(this.generateNewDateTime);
            });
          }}
        >
          {this.state.period}
        </button>
      </div>
    )
  }
}

// NewWorkoutModule.propTypes = {
//   onClose: PropTypes.func.isRequired,
//   show: PropTypes.bool,
//   children: PropTypes.node
// };

export default NewWorkoutModule;
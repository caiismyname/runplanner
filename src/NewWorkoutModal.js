// Credit to https://daveceddia.com/open-modal-in-react/

import React from 'react';
import moment from 'moment';
// import PropTypes from 'prop-types';

class NewWorkoutModule extends React.Component {
  constructor(props) {
    super(props);

    this.handleWorkoutContentChange = this.handleWorkoutContentChange.bind(this);
    this.handleWorkoutTypeChange = this.handleWorkoutTypeChange.bind(this);
  }

  generateDisplayDate() {
      return moment(this.props.payload.date).format("M/DD/YY");
  }

  timeSetter(timeString) {
    // TODO I have no idea how to address timezones. This is a problem for later.
    let time = moment(timeString);
    time.hour(8);
    time.minute(0);
    return time;
  }

  handleWorkoutContentChange(event) {
    const newPayload = {
      type: this.props.payload.type,
      content: event.target.value,
      date: this.props.id === "" ? this.timeSetter(this.props.payload.date).toISOString() : this.props.payload.date,
    }
    this.props.updateDayContentFunc(this.props.id, newPayload);
  }

  handleWorkoutTypeChange(event) {
    const newPayload = {
      type: event.target.value,
      content: this.props.payload.content,
      date: this.props.id === "" ? this.timeSetter(this.props.payload.date).toISOString() : this.props.payload.date,
    }
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
        <h1>{this.generateDisplayDate()}</h1>
        <h2>Type</h2>
        <textarea value={this.props.payload.type} onChange={this.handleWorkoutTypeChange}/>
        <h2>Content</h2>
        <textarea value={this.props.payload.content} onChange={this.handleWorkoutContentChange}/>

        <div className="footer">
          <button onClick={this.props.onClose}>
            Close
          </button>
        </div>
      </div>
    );
  }
}

// NewWorkoutModule.propTypes = {
//   onClose: PropTypes.func.isRequired,
//   show: PropTypes.bool,
//   children: PropTypes.node
// };

export default NewWorkoutModule;
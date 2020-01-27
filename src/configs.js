import PropTypes from 'prop-types';

export const dbAddress = "http://localhost:4000/runplannerDB/";
export const serverDateFormat = "YYYY-MM-DD";
export const defaultView = {
  CALENDAR: "calendar",
  COUNTDOWN: "countdown",
};
export const gClientID = "953053521176-om8kfj3ei7g0pm6dq6cohhhb7ucnhaje.apps.googleusercontent.com";

// For NewWorkoutModule
export const workoutFields = {
  TYPE: "type",
  CONTENT: "content",
  DATE: "date",
};
export const timeFields = {
  HOUR: "hour",
  "MINUTE": "minute",
};
export const dateDisplayFormat = "M/DD/YY";

// Payload is consistently repeated across PropTypes
export const payloadWithIDPropType = PropTypes.shape({
  "id": PropTypes.string,
  "payload": PropTypes.shape({
    "content": PropTypes.string,
    "date": PropTypes.string,
    "type": PropTypes.string,
  })
});

export const payloadPropType = PropTypes.shape({
  "content": PropTypes.string,
  "date": PropTypes.string,
  "type": PropTypes.string,
});
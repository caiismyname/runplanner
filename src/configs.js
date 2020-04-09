import PropTypes from 'prop-types';

export const dbAddress = "http://localhost:4000/runplannerDB/";
export const serverDateFormat = "YYYY-MM-DD";
export const defaultView = {
  CALENDAR: "calendar",
  COUNTDOWN: "countdown",
};
export const gClientID = "953053521176-om8kfj3ei7g0pm6dq6cohhhb7ucnhaje.apps.googleusercontent.com";
export const gCalAPIKey = "AIzaSyAS8CDSgFOby27S3H1jy4wmY_-Z3XbxZoA";
export const gCalDefaultName = "RunPlanner";

// For NewWorkoutModule
export const workoutFields = {
  TYPE: "type",
  CONTENT: "content",
  STARTDATE: "startDate",
  MILAGE_GOAL: "milage.goal",
  MILAGE_ACTUAL: "milage.actual",
};
export const timeFields = {
  HOUR: "hour",
  MINUTE: "minute",
};
export const dateDisplayFormat = "M/DD/YY";

// Payload is consistently repeated across PropTypes
export const payloadWithIDPropType = PropTypes.shape({
  "id": PropTypes.string,
  "payload": PropTypes.shape({
    "content": PropTypes.string,
    "date": PropTypes.string,
    "type": PropTypes.string,
    "milage": PropTypes.shape({
      "goal": PropTypes.number,
      "actual": PropTypes.number,
    })
  })
});

export const payloadPropType = PropTypes.shape({
  "content": PropTypes.string,
  "date": PropTypes.string,
  "type": PropTypes.string,
  "milage": PropTypes.shape({
    "goal": PropTypes.number,
    "actual": PropTypes.number,
  })
});

// Autofill types
export const autofillTypes = {
  WEEKLY_MILAGE_GOAL: "weekly_milage_goal",
}
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
export const calendarDateDisplayFormat = "D";
export const editModuleDateDisplayFormat = "M-DD-YY";
export const calendarDayLabelFormat = "dddd";

export const creationTypes = {
	OWNER: "owner",
	AUTOFILLWEEK: "autofillWeek",
	REPEATINGWORKOUT: "repeatingWorkout",
};

export const autofillDistributions = {
	EVEN: "even",
	RANDOM: "random",
	PYRAMID: "pyramid",
	STAIRCASEUP: "staircaseUp",
	STAIRCASEDOWN: "staircaseDown",
};

export const workoutTypes = {
	WORKOUT: 'workout',
	RECOVERY: 'recovery',
};

// Payload is consistently repeated across PropTypes
export const payloadPropType = PropTypes.shape({
	"content": PropTypes.string,
	"date": PropTypes.string,
	"type": PropTypes.string,
	"milage": PropTypes.shape({
		"goal": PropTypes.number,
		"actual": PropTypes.number,
	}),
});

export const payloadWithIDPropType = PropTypes.shape({
	"id": PropTypes.string,
	"payload": payloadPropType,
});

export const weeklyGoalPayloadPropType = PropTypes.shape({
	payload: PropTypes.shape({
		startDate: PropTypes.string,
		endDate: PropTypes.string,
		goalType: PropTypes.oneOf(["weekly_milage_goal", "weekly_time_goal"]),
		goalValue: PropTypes.number,
	}),
	goalID: PropTypes.string,
});

// Autofill types
export const autofillTypes = {
	WEEKLY_MILAGE_GOAL: "weekly_milage_goal",
};

export const grommetTheme = {
	global: {
	  font: {
		family: 'Helvetica Neue',
		size: '14px',
		height: '20px',
	  },
	},
  };

export const toSentenceCase = (word) => {
	return (word[0].toUpperCase() + word.slice(1).toLowerCase());
};
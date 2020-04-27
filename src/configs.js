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

export const appName = 'RunPlanner';

// For NewWorkoutModule
export const workoutFields = {
    TYPE: "type",
    CONTENT: "content",
    STARTDATE: "startDate",
    mileage_GOAL: "mileage.goal",
    mileage_ACTUAL: "mileage.actual",
};
export const timeFields = {
    HOUR: "hour",
    MINUTE: "minute",
};
export const calendarDateDisplayFormat = "D";
export const editModuleDateDisplayFormat = "M-DD-YY";
export const calendarDayLabelFormat = "dddd";

export const defaultRunDurations = [15, 30, 45, 60, 75, 90, 105, 120];
export const creationTypes = {
    OWNER: "owner",
    AUTOFILLWEEK: "autofillWeek",
    REPEATINGWORKOUT: "repeatingWorkout",
};

export const autofillDistributions = {
    EVEN: 'Even',
    // RANDOM: "random",
    // PYRAMID: "pyramid",
    // STAIRCASEUP: "staircaseUp",
    // STAIRCASEDOWN: "staircaseDown",
};

export const workoutTypes = {
    WORKOUT: 'Workout',
    RECOVERY: 'Recovery',
};

// Payload is consistently repeated across PropTypes
export const payloadPropType = PropTypes.shape({
    "content": PropTypes.string,
    "date": PropTypes.string,
    "type": PropTypes.string,
    "mileage": PropTypes.shape({
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
        goalType: PropTypes.oneOf(["weekly_mileage_goal", "weekly_time_goal"]),
        goalValue: PropTypes.number,
    }),
    goalID: PropTypes.string,
});

// Autofill types
export const autofillTypes = {
    WEEKLY_mileage_GOAL: "weekly_mileage_goal",
};

export const goalControlColor = 'neutral-3';
export const brandColor = '#d99c18';

export const grommetTheme = {
    global: {
        font: {
            family: 'Helvetica Neue',
            size: '14px',
            height: '20px',
        },
        colors: {
            brand: brandColor,
            focus: 'neutral-4',
        },
        meter: {
            color: goalControlColor,
        },
    },
};

export const toSentenceCase = (word) => {
    return (word[0].toUpperCase() + word.slice(1).toLowerCase());
};

export const getNumberOfDaysInMonth = (month, year) => {
    // Moment months are 0 indexed (0 is January), but JS Date Months are 1 indexed
    // so we need a + 1 on the month to convert

    // Source: https://www.geeksforgeeks.org/how-to-get-the-number-of-days-in-a-specified-month-using-javascript/
    return (new Date(year, month + 1, 0).getDate());
};

export const loaderTimeout = 3000;
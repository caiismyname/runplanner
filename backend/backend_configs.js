let Users = require('./runplanner-user.model');

const serverDateFormat = "YYYY-MM-DD";
const PORT = 4000;
const mongoAddress = 'mongodb://127.0.0.1:27017/runplanner';
// How do we keep these enums in sync across the FE and BE configs?
const creationTypes = {
	OWNER: "owner",
  	AUTOFILLWEEK: "autofillWeek",
  	REPEATINGWORKOUT: "repeatingWorkout",
};

const autofillDistributions = {
	EVEN: "even",
	RANDOM: "random",
	PYRAMID: "pyramid",
	STAIRCASEUP: "staircaseUp",
	STAIRCASEDOWN: "staircaseDown",
};

const workoutTypes = {
	WORKOUT: 'Workout',
	RECOVERY: 'Recovery',
};

const proceedIfUserExists = (id, successCallback, failureCallback) => {
	// Users.findOne({ _id: id }).select("_id").lean().then(result => {
	//     result ? successCallback(result) : failureCallback();
	// }).catch(e => failureCallback());)

	Users.findById(id, function (err, result) {
		if (result) {
			successCallback(result);
		} else {
			failureCallback(err);
		}
	});
};

const roundToOneDecimal = (number) => {
	return (Math.round(number * 10) / 10);
};

exports.serverDateFormat = serverDateFormat;
exports.PORT = PORT;
exports.mongoAddress = mongoAddress;
exports.creationTypes = creationTypes;
exports.autofillDistributions = autofillDistributions;
exports.proceedIfUserExists = proceedIfUserExists;
exports.workoutTypes = workoutTypes;
exports.roundToOneDecimal = roundToOneDecimal;
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

exports.serverDateFormat = serverDateFormat;
exports.PORT = PORT;
exports.mongoAddress = mongoAddress;
exports.creationTypes = creationTypes;
exports.autofillDistributions = autofillDistributions;
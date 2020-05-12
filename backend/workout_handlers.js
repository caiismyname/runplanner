const { authorizeToGoogle, addGCalEvents, updateGCalEvents, deleteGCalEvents } = require('./google_handlers');
const { proceedIfUserExists } = require('./backend_configs');

let Workouts = require("./runplanner-workout.model");

const addWorkouts = (workoutsToAdd, userID, successCallback, failureCallback) => {
    let promises = [];
    let fullWorkouts = [];

    workoutsToAdd.forEach(w => {
        const promise = new Promise(function (resolve, reject) {
            proceedIfUserExists(w.owner,
                () => {
                    let workout = new Workouts(w);
                    workout.save(function (err, savedWorkout) {
                        if (err) {
                            console.log(err);
                            reject();
                        } else {
                            fullWorkouts.push(savedWorkout);
                            console.log("Adding workout: " + savedWorkout._id);
                            resolve();
                        }
                    });
                },
                () => {
                    console.log("user does not exist");
                    reject();
                }
            );
        });
        promises.push(promise);
    });

    Promise.all(promises).then(
        () => {
            // Add GCal event
            authorizeToGoogle(userID, fullWorkouts, successCallback, failureCallback, addGCalEvents);
        },
        () => failureCallback()
    );
};

const deleteWorkouts = (workoutsToDelete, userID, callback) => {
    let promises = [];
    let deleted = [];

    workoutsToDelete.forEach(id => {
        const promise = new Promise(function (resolve, reject) {
            console.log(id);
            Workouts.findById(id, function (err, workout) {
                if (!workout) {
                    reject();
                } else {
                    const startDate = workout.payload.startDate;
                    const gEventID = workout.gEventID;
                    Workouts.deleteOne({ _id: id })
                        .then(() => {
                            console.log("Deleted " + id);
                            deleted.push({ id: id, startDate: startDate, gEventID: gEventID });
                            resolve();
                        })
                        .catch(err => { reject() });
                }
            });
        });

        promises.push(promise);
    })

    Promise.all(promises).then(
        () => {
            authorizeToGoogle(
                userID,
                deleted.map(x => x.gEventID),
                () => callback(deleted),
                () => callback(deleted),
                deleteGCalEvents);
        },
        () => callback(null)
    );
};

const updateWorkouts = (workoutsToUpdate, userID, callback) => {
    let updatedWorkouts = [];
    let promises = [];

    Object.keys(workoutsToUpdate).forEach((key, idx) => {
        const promise = new Promise(function (resolve, reject) {
            let workoutToUpdate = workoutsToUpdate[key];
            Workouts.findById(workoutToUpdate.id, function (err, workout) {
                if (!workout) {
                    console.log('Could not find workout ' + workoutToUpdate.id);
                    reject();
                } else {
                    workout.payload = workoutToUpdate.payload;
                    workout.owner = workoutToUpdate.owner; // There shouldn't be a need to re-save owner 

                    workout.save()
                        .then(workout => {
                            updatedWorkouts.push(workout);
                            resolve();
                        })
                        .catch(err => {
                            console.log(err);
                            reject();
                        });
                }
            });
        });

        promises.push(promise);
    });

    Promise.all(promises).then(
        () => {
            // Update GCal events
            authorizeToGoogle(userID, updatedWorkouts, callback, callback, updateGCalEvents);
        },
        () => callback(null)
    )
};

const getWorkoutsForOwnerForDateRange = (ownerID, startDate, endDate, callback, additionalFilters) => {
    proceedIfUserExists(ownerID, (owner) => {
        let query =  {
            "payload.startDate": {
                $gte: new Date(startDate),
                $lte: new Date(endDate),
            },
            "owner": ownerID,
        };

        if (additionalFilters) {
            query = {...query, ...additionalFilters};
        }

        Workouts.find(
            query,
            (err, items) => {
                if (err) {
                    console.log(err);
                    callback(null);
                } else {
                    let formattedItems = items.map(workout => {
                        return {
                            "payload": workout.payload,
                            "owner": workout.owner,
                            "id": workout._id,
                        }
                    });
                    callback(formattedItems);
                }
            }
        );
    },
        () => { callback(null) });

};

exports.addWorkouts = addWorkouts;
exports.deleteWorkouts = deleteWorkouts;
exports.updateWorkouts = updateWorkouts;
exports.getWorkoutsForOwnerForDateRange = getWorkoutsForOwnerForDateRange;

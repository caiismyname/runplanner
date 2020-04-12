const GOOGLE_CLIENT_SECRET = require('./client_secret').getGoogleClientSecret();
const GOOGLE_CLIENT_ID = require('./client_secret').getGoogleClientID();
const GOOGLE_REDIRECT_URIS = require('./client_secret').getGoogleRedirectURIs();

let Users = require('./runplanner-user.model');
let Workouts = require("./runplanner-workout.model");

const {google} = require('googleapis');
const moment = require('moment-timezone');

// TODO refactor into one callback
const authorizeToGoogle = (userID, objects, successCallback, failureCallback, calendarFunc) => {
    const oAuth2Client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URIS);
    Users.findById(userID, (err, user) => {
        const tokens = {
            'access_token': user.gTokens.accessToken,
            'refresh_token': user.gTokens.refreshToken,
        };
        const calendarID = user.calendarID;
        const userConfig = user.config;
        
        oAuth2Client.setCredentials(tokens);
        calendarFunc(oAuth2Client, calendarID, userConfig, objects, successCallback, failureCallback);
    });
};

const addGCalEvents = (auth, calendarID, userConfig, workouts, successCallback, failureCallback) => {
    sendGCalEvents(auth, calendarID, userConfig, workouts, successCallback, failureCallback, false);
};

const updateGCalEvents = (auth, calendarID, userConfig, workouts, successCallback, failureCallback) => {
    sendGCalEvents(auth, calendarID, userConfig, workouts, successCallback, failureCallback, true);
};

const sendGCalEvents = (auth, calendarID, userConfig, workouts, successCallback, failureCallback, isUpdate) => {
    const calendar = google.calendar({version: 'v3', auth});
    let workoutsToReturn = [];
    let promises = [];

    workouts.forEach(workout => {
        const title = workout.payload.milage.goal === 0 
            ? "New run" 
            : workout.payload.milage.goal + " mile run";
        const promise = new Promise(function(resolve, reject) {
            const eventResource = {
                'calendarId': calendarID,
                'resource': {
                    'summary': title,
                    'start': {
                        'dateTime': workout.payload.startDate,
                        'timeZone': userConfig.mainTimezone
                    },
                    'end': {
                        'dateTime': moment(workout.payload.startDate).add(userConfig.defaultRunDuration, "minutes").toISOString(),
                        'timeZone': userConfig.mainTimezone
                    }
                }
            };

            // Create a single callback (for both updates and creations)
            // to update Mongo once the gCal operation is complete.
            const gCalCallback = (event) => {
                // Save the workout with gEventID if adding a new workout
                // Then (for both update and add) add the most up-to-date workout object 
                // to the list, and resolve the promise.
                Workouts.findById(workout._id, function(err, workout) {
                    if (workout) {
                        if (!isUpdate) {
                            workout.gEventID = event.data.id;
                            workout.save()
                            .then(workout => {
                                workoutsToReturn.push(workout);
                                resolve();
                            })
                            .catch(err => {
                                console.log(err);
                                reject();
                            });
                        } else {
                            workoutsToReturn.push(workout);
                            resolve();
                        }
                    } else {
                        console.log("Workout " + workout._id + " not found: " + err);
                        reject();
                    }
                });
            };

            if (isUpdate) {
                eventResource.eventId = workout.gEventID;
                // In the future, may need to override the endtime if we allow custom times
                calendar.events.update(eventResource).then(gCalCallback);   
            } else {
                calendar.events.insert(eventResource).then(gCalCallback);
            }
        });

        promises.push(promise);
    });

    Promise.all(promises).then(
        () => {
            successCallback(workoutsToReturn);
        },
        () => {
            failureCallback(null);
        }
    );
};

const deleteGCalEvents = (auth, calendarID, userConfig, gEventIDs, callback, unusedCallback) => {
    const calendar = google.calendar({version: 'v3', auth});
    let promises = [];
    let deletedIDs = [];
    
    gEventIDs.forEach(id => {
        const promise = new Promise(function(resolve, reject) {
            const eventResource = {
                calendarId: calendarID,
                eventId: id,
            };
            calendar.events.delete(eventResource).then(() => {
                deletedIDs.push(id);
                resolve();
            });
        });

        promises.push(promise);
    });

    Promise.all(promises).then(
        () => {
            callback(deletedIDs);
        },
        () => {callback(null)}
    );
};

exports.authorizeToGoogle = authorizeToGoogle;
exports.addGCalEvents = addGCalEvents;
exports.updateGCalEvents = updateGCalEvents;
exports.sendGCalEvents = sendGCalEvents;
exports.deleteGCalEvents = deleteGCalEvents;
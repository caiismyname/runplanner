const GOOGLE_CLIENT_SECRET = require('./client_secret').getGoogleClientSecret();
const GOOGLE_CLIENT_ID = require('./client_secret').getGoogleClientID();
const GOOGLE_REDIRECT_URIS = require('./client_secret').getRedirectURIs();

const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const cors = require("cors");
const mongoose = require("mongoose");
const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
const runplannerRoutes = express.Router();
const {google} = require('googleapis');
const moment = require('moment-timezone');
const PORT = 4000;
const serverDateFormat = "YYYY-MM-DD"; // Gotta figure out how to import from configs.js

let Workouts = require("./runplanner-workout.model");
let Users = require("./runplanner-user.model");
let WeeklyGoals = require("./runplanner-weeklyGoal.model");

app.use(cors());
app.use(bodyParser.json());

function proceedIfUserExists(id, successCallback, failureCallback) {
    // Users.findOne({ _id: id }).select("_id").lean().then(result => {
    //     result ? successCallback(result) : failureCallback();
    // }).catch(e => failureCallback());)

    Users.findById(id, function(err, result) {
        if (result) {
            successCallback(result);
        } else {
            failureCallback(err);
        }
    })
}

mongoose.connect(
    "mongodb://127.0.0.1:27017/runplanner", 
    {useNewUrlParser: true,}
);

const connection = mongoose.connection;

connection.once("open", function() {
    console.log("MongoDB database connection established successfully");
});

//
//
// User CRUD operations
//
//

runplannerRoutes.route("/adduser").post(function(req, res) {
    let user = new Users(req.body);
    user.save()
        .then(user => {res.status(200).json("New user added successfully")})
        .catch(err => {res.status(400).send("Adding new user failed")});
});

runplannerRoutes.route("/deleteuser").post(function(req, res) {
    proceedIfUserExists(req.body.id,
        () => {
            Users.deleteOne({_id: req.body.id})
                .then(res.status(200).json("User deleted successfully"))
                .catch(err => {res.status(400).send("Deleting user failed")});
        }, 
        () => {res.status(404).send("User not found");}
    );
})

runplannerRoutes.route("/checkuser").post(function(req, res) {
    proceedIfUserExists(req.body.id,
        () => {res.status(200).json({"userExists": true})},
        () => {res.status(200).json({"userExists": false})},
    );
})

runplannerRoutes.route("/updateuser").post(function(req, res) {
    Users.findById(req.body.id, function(err, user) {
        if (!user) {
            res.status(404).send("User not found");
        } else {
            user.config = req.body.config;
            // App should never invoke an update of gTokens or calendarID

            user.save()
                .then(user => {res.status(200).json("User updated")})
                .catch(err => res.status(404).send("User update failed"));
        }
    })
})

runplannerRoutes.route("/getuser/:id").get(function(req, res){ 
    Users.findOne({_id: req.params.id}, (err, item) => {
        if (err) {
            console.log(err);
        } else {
            if (!item) {
                res.status(404).send("User not found");
            } else {
                res.json(item);
            }
        }
    });
})

runplannerRoutes.route("/inituserserverauth").post(function(req, res) {
    // TODO Check for X-Requested-With
    const authCode = req.body.authCode;

    // Send HTTP request to exchange authCode for auth token, refresh toekn
    const http = new XMLHttpRequest();
    const url = 'https://oauth2.googleapis.com/token';
    const params = {
        'client_id': GOOGLE_CLIENT_ID,
        'client_secret': GOOGLE_CLIENT_SECRET,
        'code': authCode,
        'grant_type': 'authorization_code',
        'redirect_uri': 'http://localhost:3000',
    };

    http.open("POST", url);
    http.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    http.send(JSON.stringify(params));

    http.onreadystatechange = (e) => {
        console.log(http.readyState);
        if (http.readyState === 4) { // status 4 = request is finished and response is ready
            const response = JSON.parse(http.responseText); // response is undefined, but responseText is defined, for some reason
            const accessToken = response.access_token;
            const refreshToken = response.refresh_token;

            Users.findById(req.body.userID, function(err, user) {
                if (!user) {
                    res.status(404).send("User not found");
                } else {
                    user.gTokens = {'accessToken': accessToken, 'refreshToken': refreshToken};
        
                    user.save()
                        .then(user => {res.status(200).json("User gTokens stored")})
                        .catch(err => res.status(404).send("Storing user gTokens failed"));
                }
            });
        }
    }
})

//
//
// Workout CRUD operations
//
//

function addWorkouts(workoutsToAdd, userID, successCallback, failureCallback) {
    let promises = [];
    let fullWorkouts = [];

    console.log("adding workouts");
    console.log(workoutsToAdd);

    workoutsToAdd.forEach(w => {
        const promise = new Promise(function(resolve, reject) {
            proceedIfUserExists(w.owner, 
                () => {
                    console.log("user exists");
                    let workout = new Workouts(w);
                    workout.save(function(err, savedWorkout) {
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
}

runplannerRoutes.route("/addworkouts").post(function(req, res) {
    addWorkouts(req.body.toAdd, req.body.userID, 
        // success callback
        (workoutsToReturn) => {
            res.status(200).json({
                "message": workoutsToReturn.length + " workout(s) added successfully", 
                "workouts": workoutsToReturn}
            );
        },
        // failure callback
        () => {res.status(400).send("Adding new workout(s) failed")}
    );
});

runplannerRoutes.route("/deleteworkout/:id").post(function(req, res) {
    Workouts.findById(req.params.id, function(err, workout) {
        if (!workout) {
            res.status(404).send("Workout not found");
        } else {
            Workouts.deleteOne({_id: req.params.id})
                .then(res.status(200).json("Workout deleted successfully"))
                .catch(err => {res.status(400).send("Deleting workout failed")});
        }
    });
});

runplannerRoutes.route("/updateworkouts").post(function(req, res) {
    let updatedWorkouts = [];
    let promises = [];
    Object.keys(req.body.toUpdate).forEach((key,idx) => {
        const promise = new Promise(function(resolve, reject) {
            let workoutToUpdate = req.body.toUpdate[key];
            Workouts.findById(workoutToUpdate.id, function(err, workout) {
                if (!workout) {
                    res.status(404).send("Workout not found");
                } else {
                    workout.payload = workoutToUpdate.payload;
                    workout.owner = workoutToUpdate.owner; // There shouldn't be a need to re-save owner 
        
                    workout.save()
                        .then(workout => {
                            updatedWorkouts.push(workout);
                            resolve();
                        })
                        .catch(err => {
                            reject();
                        });
                }
            });
        });

        promises.push(promise);
    });

    Promise.all(promises).then(
        () => {
            const successCallback = (workoutsToReturn) => {
                res.status(200).json({
                    "message": workoutsToReturn.length + " workout(s) added successfully", 
                    "workouts": workoutsToReturn}
                );
            };

            const failureCallback = () => {res.status(400).send("Updating workout(s) failed")};
            // Update GCal events
            authorizeToGoogle(req.body.userID, updatedWorkouts, successCallback, failureCallback, updateGCalEvents);
        },
        () => failureCallback()
    )
});

runplannerRoutes.route("/getworkoutforownerfordate/:id/:date").get(function(req, res) {
    Workouts.findOne(
        {owner: req.params.id, date: req.params.date}, 
        (err, item) => {
            if (err) {
                console.log(err);
            } else {
                if (!item) {
                    res.status(404).send("Workout not found");
                } else {
                    let formattedItems = items.map(workout => { 
                        return {  
                            "payload": workout.payload,
                            "id": workout._id,
                        }
                    });
                    res.json(formattedItems);
                }           
            }
        }
    );
});

function getWorkoutsForOwnerForDateRange(ownerID, startDate, endDate, callback) {
    proceedIfUserExists(ownerID, (owner) => {
        Workouts.find(
            { 
                "payload.startDate": { 
                    $gte: new Date(startDate), 
                    $lte: new Date(endDate)
                },
                "owner": ownerID
            },
            (err, items) => {
                if (err) {
                    console.log(err);
                    callback(null);
                } else {
                    let formattedItems = items.map(workout => { 
                        return {  
                            "payload": workout.payload,
                            "id": workout._id,
                        }
                    });
                    callback(formattedItems);
                }
            }
        );
    }, 
    () => {callback(null)});
    
}

runplannerRoutes.route("/getworkoutsforownerfordaterange/:id/:gtedate/:ltedate").get(function(req, res) {
    getWorkoutsForOwnerForDateRange(req.params.id, req.params.gtedate, req.params.ltedate, (workouts) => {
        if (workouts) {
            res.json(workouts);
        } else {
            res.status(400).send("getting workouts failed");
        }      
    });
})



//
//
// Google Calendar Access
//
//

function authorizeToGoogle(userID, workouts, successCallback, failureCallback, calendarFunc) {
    const oAuth2Client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URIS);
    Users.findById(userID, (err, user) => {
        const tokens = {
            'access_token': user.gTokens.accessToken,
            'refresh_token': user.gTokens.refreshToken,
        };
        const calendarID = user.calendarID;
        const timezone = user.mainTimezone;
        const defaultRunDuration = user.config.defaultRunDuration;
        
        oAuth2Client.setCredentials(tokens);
        calendarFunc(oAuth2Client, calendarID, timezone, defaultRunDuration, workouts, successCallback, failureCallback);
    });
}

function addGCalEvents(auth, calendarID, timezone, defaultRunDuration, workouts, successCallback, failureCallback) {
    sendGCalEvents(auth, calendarID, timezone, defaultRunDuration, workouts, successCallback, failureCallback, false);
}

function updateGCalEvents(auth, calendarID, timezone, defaultRunDuration, workouts, successCallback, failureCallback) {
    sendGCalEvents(auth, calendarID, timezone, defaultRunDuration, workouts, successCallback, failureCallback, true);
}

function sendGCalEvents(auth, calendarID, timezone, defaultRunDuration, workouts, successCallback, failureCallback, isUpdate) {
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
                        'timeZone': timezone
                    },
                    'end': {
                        'dateTime': moment(workout.payload.startDate).add(defaultRunDuration, "minutes").toISOString(),
                        'timeZone': timezone
                    }
                }
            };

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
            }

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
        () => successCallback(workoutsToReturn),
        () => failureCallback()
    );
}  

//
//
// WeeklyGoal CRUD operations
//
//

runplannerRoutes.route("/getweeklygoalsforownerfordaterange/:id/:gtedate/:ltedate").get(function(req, res) {
    WeeklyGoals.find(
        { 
            "startDate": { 
                $gte: new Date(req.params.gtedate), 
                $lte: new Date(req.params.ltedate)
            },
            "ownerID": req.params.id
        },
        (err, items) => {
            if (err) {
                console.log(err);
            } else {
                let formattedItems = items.map(goal => { 
                    return ({  
                        startDate: goal.startDate,
                        endDate: goal.endDate,
                        goalValue: goal.goalValue,
                        goalType: goal.goalType,
                        goalID: goal._id,
                    });
                });
                res.json(formattedItems);
            }
        }
    );
})

runplannerRoutes.route("/addweeklygoals").post(function(req, res) {
    var newIDs = [];
    let promises = [];
    // This assumes workout order will be preserved across all calls.
    for (let i = 0; i < req.body.toAdd.length; i++) {
        const g = req.body.toAdd[i];
        const promise = new Promise(function(resolve, reject) {
            proceedIfUserExists(g.ownerID, 
                (i) => {
                    let weeklyGoal = new WeeklyGoals(g);
                    weeklyGoal.save(function(err, goal) {
                        if (err) {
                            reject();
                        } else {
                            newIDs.splice(i, 1, goal._id);
                            console.log("Adding weekly goal: " + goal._id);
                            resolve();
                        }
                    });
                },
                () => reject()
            );
        });
        promises.push(promise);
    };

    Promise.all(promises).then(
        () => {
            res.status(200).json({
                "message": newIDs.length + " weekly goals(s) added successfully", 
                "ids": newIDs,
            });
        }, 
        () => res.status(400).send("Adding new weekly goal(s) failed")
    );
});

runplannerRoutes.route("/updateweeklygoals").post(function(req, res) {
    Object.keys(req.body.toUpdate).forEach((key,idx) => {
        let goalToUpdate = req.body.toUpdate[key];
        WeeklyGoals.findById(goalToUpdate.goalID, function(err, goal) {
            if (!goal) {
                res.status(404).send("Weekly goal not found");
            } else {
                goal.startDate = goalToUpdate.startDate;
                goal.endDate = goalToUpdate.endDate;
                goal.goalValue = goalToUpdate.goalValue;
                goal.goalType = goalToUpdate.goalType;
                goal.ownerID = goalToUpdate.ownerID;
    
                goal.save()
                    .then(goal => {res.json(req.body.toUpdate.length + " weekly goal(s) updated")})
                    .catch(err => {res.status(400).send("Weekly goal update failed")});
            }
        });
    });
});

runplannerRoutes.route("/deleteweeklygoal/:id").post(function(req, res) {
    WeeklyGoals.findById(req.params.id, function(err, goal) {
        if (!goal) {
            res.status(404).send("Weekly goal not found");
        } else {
            WeeklyGoal.deleteOne({_id: req.params.id})
                .then(res.status(200).json("Weekly goal deleted successfully"))
                .catch(err => {res.status(400).send("Deleting weekly goal failed")});
        }
    });
});

runplannerRoutes.route("/autofillweek").post(function(req, res) {
    proceedIfUserExists(req.body.userID, 
        (user) => {
            WeeklyGoals.findById(req.body.goalID, function(err, goal) {
                getWorkoutsForOwnerForDateRange(req.body.userID, goal.startDate, goal.endDate, (workouts) => {
                    generateAutofillWorkouts(
                        workouts, 
                        goal.startDate, 
                        goal.endDate, 
                        goal.goalValue, 
                        user.config, 
                        req.body.userID, 
                        (workoutsToReturn) => {
                            console.log('made it to the callback');
                            console.log(workoutsToReturn);
                            if (workoutsToReturn) {
                                res.status(200).json({
                                    message: workoutsToReturn.length + 'automatic workouts added successfully', 
                                    workouts: workoutsToReturn}
                                );
                            } else {
                                res.status(400).send('Autofilling weekly goals failed');
                            }
                        });
                });  
            })
        },
        () => {res.status(400).send('Autofilling weekly goals failed')})
});

function generateAutofillWorkouts(existingWorkouts, weekStart, weekEnd, goal, userConfig, ownerID, callback) {
    let numDaysToFill = 0;
    let allocatedTotal = 0;
    let newWorkouts = [];
    let days = {}; // key = date, value = list of workouts on that day, if any

    console.log("generating workouts");

    // Sort workouts by day
    let currentDay = moment(weekStart);
    while (!currentDay.isAfter(moment(weekEnd))) { // Weeks are defined by their start and end inclusively
        const date = currentDay.format(serverDateFormat);
        const existingWorkoutsOnThisDate = existingWorkouts.filter(workout => moment(workout.payload.startDate).isSame(currentDay, 'day'));
        days[date] = existingWorkoutsOnThisDate; // will return [] if no workouts on that day
        currentDay.add(1, "day");
    }

    console.log(days);

    // Calculate how many days/miles we have to work with
    Object.values(days).forEach(workoutList => {
        if (workoutList !== []) {
            numDaysToFill += 1;
            // TODO need to consider completed workouts
            allocatedTotal += workoutList.reduce((milage, workout) => {return(milage + workout.payload.milage.goal)}, 0);
        }
    });

    // Fill the open days according to the user's chosen distribution
    if (userConfig.autofillConfig.distribution === "even") {
        const dailyMilage = (goal - allocatedTotal) / numDaysToFill;
        const templateWorkout = {
            owner: ownerID,
            payload: {
                startDate: "",
                content: "Auto-populated milage run",
                type: "Recovery Run",
                milage: {
                  goal: dailyMilage,
                },
                creationType: "autofillWeek", // TODO gotta import that config
            }
        };

        for (const date in days) {
            if (days[date].length === 0) {
                const workout = {...templateWorkout};
                
                let startDatetime = moment(date);
                startDatetime.hour(userConfig.defaultStartTime.hour);
                startDatetime.minute(userConfig.defaultStartTime.minute);
                startDate = moment.tz(startDatetime, this.mainTimezone);
                workout.payload.startDate = startDatetime.toISOString();

                newWorkouts.push(workout);
            }
        }
    } else if (config.autofillConfig.distribution === "random") {

    }


    // Actually store the workouts
    addWorkouts(newWorkouts, ownerID, 
        (addedWorkoutouts) => {callback(addedWorkoutouts)},
        () => {callback(null)}
    );
}

// Misc

app.use("/runplannerDB", runplannerRoutes);
app.listen(PORT, function() {
    console.log("Server is running on Port: " + PORT);
});
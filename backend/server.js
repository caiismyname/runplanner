const GOOGLE_CLIENT_SECRET = require('./client_secret').getGoogleClientSecret();
const GOOGLE_CLIENT_ID = require('./client_secret').getGoogleClientID();

const {addWorkouts, deleteWorkouts, updateWorkouts, getWorkoutsForOwnerForDateRange} = require('./mongo_workout_handlers');

const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const cors = require("cors");
const mongoose = require("mongoose");
const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
const runplannerRoutes = express.Router();
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


runplannerRoutes.route("/addworkouts").post(function(req, res) {
    addWorkouts(req.body.toAdd, req.body.userID, 
        // success callback
        (workoutsToReturn) => {
            res.status(200).json({
                "message": workoutsToReturn.length + " workout(s) added successfully", 
                "workouts": workoutsToReturn,
            });
        },
        // failure callback
        () => {res.status(400).send("Adding new workout(s) failed")}
    );
});

runplannerRoutes.route('/deleteworkouts').post(function(req, res) {
    deleteWorkouts(req.body.toDelete, req.body.userID,
      (deleted) => {
        if (deleted) {
            res.status(200).json({
                message: deleted.length + ' workout(s) deleted successfully',
                deleted: deleted,
            });
        }  else {
            res.status(400).send('Deleting workout(s) failed');
        }
    });
});

runplannerRoutes.route("/updateworkouts").post(function(req, res) {
    const callback = (workoutsToReturn) => {
        if (workoutsToReturn !== null) {
            res.status(200).json({
                "message": workoutsToReturn.length + " workout(s) added successfully", 
                "workouts": workoutsToReturn}
            );
        } else {
            res.status(400).send("Updating workout(s) failed")
        }
    };

    updateWorkouts(req.body.toUpdate, req.body.userID, callback);
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
// WeeklyGoal CRUD operations
//
//

runplannerRoutes.route("/getweeklygoalsforownerfordaterange/:id/:gtedate/:ltedate").get(function(req, res) {
    WeeklyGoals.find(
        { 
            "payload.startDate": { 
                $gte: new Date(req.params.gtedate), 
                $lte: new Date(req.params.ltedate)
            },
            "ownerID": req.params.id
        },
        (err, items) => {
            if (err) {
                console.log(err);
            } else {
                res.json({goals: items});
            }
        }
    );
})

runplannerRoutes.route("/addweeklygoals").post(function(req, res) {
    let promises = [];
    let newGoals = [];
    // This assumes workout order will be preserved across all calls.
    req.body.toAdd.forEach(g => {
        const promise = new Promise(function(resolve, reject) {
            proceedIfUserExists(g.ownerID, 
                () => {
                    let weeklyGoal = new WeeklyGoals(g);
                    weeklyGoal.save(function(err, goal) {
                        if (err) {
                            reject();
                        } else {
                            console.log("Adding weekly goal: " + goal._id);
                            newGoals.push(goal);
                            resolve();
                        }
                    });
                },
                () => reject()
            );
        });
        promises.push(promise);
    });

    Promise.all(promises).then(
        () => {
            res.status(200).json({
                'message': newGoals.length + ' weekly goals(s) added successfully', 
                'goals': newGoals,
            });
        }, 
        () => res.status(400).send('Adding new weekly goal(s) failed')
    );
});

runplannerRoutes.route("/updateweeklygoals").post(function(req, res) {
    let updatedGoals = [];
    let promises = [];

    Object.keys(req.body.toUpdate).forEach((key,idx) => {
        const promise = new Promise(function(resolve, reject) {
            let goalToUpdate = req.body.toUpdate[key];

            WeeklyGoals.findById(goalToUpdate.goalID, function(err, goal) {
                if (!goal) {
                    res.status(404).send("Weekly goal not found");
                } else {
                    goal.payload = goalToUpdate.payload;
                    goal.save()
                        .then(goal => {
                            updatedGoals.push(goal);
                            resolve();
                        })
                        .catch(err => reject());
                }
            });
        });
        promises.push(promise);
    });

    Promise.all(promises).then(
        () => {
            res.json({
                    message: updatedGoals.length + " weekly goal(s) updated",
                    goals: updatedGoals,
            });
        },
        () => {res.status(400).send("Updating goal(s) failed")}
    );
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
                getWorkoutsForOwnerForDateRange(
                    req.body.userID, 
                    goal.payload.startDate, 
                    goal.payload.endDate, 
                    (workouts) => {
                        generateAutofillWorkouts(
                            workouts, 
                            goal.payload,
                            user.config, 
                            req.body.userID, 
                            (workoutsToReturn) => {
                                if (workoutsToReturn) {
                                    res.status(200).json({
                                        ...workoutsToReturn,
                                        message: workoutsToReturn.length + ' automatic workouts added/updated successfully', 
                                    });
                                } else {
                                    console.log('Autofilling weekly goals failed');
                                    res.status(400).send('Autofilling weekly goals failed');
                                }
                            });
                        });  
            })
        },
        () => {res.status(400).send('Autofilling weekly goals failed')})
});

// Returns true/false for if all the workouts in the list are autogenerated
function areWorkoutsSameCreationType(workoutList, creation) {
    return workoutList.reduce((all, cur) => all && (cur.payload.creationType === creation), true);
}

// This function is idempotent on existing autogenerated workouts, 
// assuming imputs (user workouts, goalValue) are the same.
function generateAutofillWorkouts(existingWorkouts, goalPayload, userConfig, ownerID, callback) {
    let numDaysToFill = 0;
    let allocatedTotal = 0;
    let newWorkouts = [];
    let updatedWorkouts = [];
    let days = {}; // key = date, value = list of workouts on that day, if any

    // Sort workouts by day
    let currentDay = moment(goalPayload.startDate);
    while (!currentDay.isAfter(moment(goalPayload.endDate))) { // Weeks are defined by their start and end inclusively
        const date = currentDay.format(serverDateFormat);
        const existingWorkoutsOnThisDate = existingWorkouts.filter(workout => moment(workout.payload.startDate).isSame(currentDay, 'day'));
        days[date] = existingWorkoutsOnThisDate; // will return [] if no workouts on that day
        currentDay.add(1, "day");
    }

    // Calculate how many days/miles we have to work with
    Object.values(days).forEach(workoutList => {
        if (workoutList.length === 0 || areWorkoutsSameCreationType(workoutList, 'autofillWeek')) {
            numDaysToFill += 1;
        } else {
            // TODO need to consider completed workouts
            allocatedTotal += workoutList.reduce((milage, workout) => {return(milage + workout.payload.milage.goal)}, 0);
        }
    });

    // Fill the open days according to the user's chosen distribution
    if (userConfig.autofillConfig.distribution === "even") {
        const dailyMilage = (goalPayload.goalValue - allocatedTotal) / numDaysToFill;
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

        for (let date in days) {
            // No existing autogenerated workouts, make new ones
            if (days[date].length === 0) { 
                // const workout = {...templateWorkout}; // IDK
                const workout = JSON.parse(JSON.stringify(templateWorkout));
                
                let startDatetime = moment(date);
                startDatetime.hour(userConfig.defaultStartTime.hour);
                startDatetime.minute(userConfig.defaultStartTime.minute);
                startDate = moment.tz(startDatetime, this.mainTimezone);
                workout.payload.startDate = startDatetime.toISOString();

                newWorkouts.push(workout);
            
            // Just update the existing autogenerated workouts
            } else if (areWorkoutsSameCreationType(days[date], 'autofillWeek')) {
                days[date].forEach(existingAutogeneratedWorkout => {
                    const updatedWorkout = JSON.parse(JSON.stringify(existingAutogeneratedWorkout));
                    updatedWorkout.payload.milage.goal = dailyMilage;
                    updatedWorkouts.push(updatedWorkout);
                });
            }
        }
    } else if (config.autofillConfig.distribution === "random") {

    }

    // Actually store the workouts.
    // Can't do res.json twice, so have to collate into one call.
    let returnedNewWorkouts;
    let returnedUpdatedWorkouts;

    const p1 = new Promise(function(resolve, reject) {
        addWorkouts(newWorkouts, ownerID, 
            (returned) => {
                returnedNewWorkouts = returned;
                resolve();
            },
            () => {
                returnedNewWorkouts = null;
                reject();
            }
        );
    });
    
    const p2 = new Promise(function(resolve, reject) {
        updateWorkouts(updatedWorkouts, ownerID, 
            (returned) => {
                returnedUpdatedWorkouts = returned;
                resolve();
            },
            () => {
                returnedUpdatedWorkouts = null;
                reject();
            }
        );
    });

    Promise.all([p1, p2]).then(
        () => {callback({added: returnedNewWorkouts, updated: returnedUpdatedWorkouts})},
        () => {callback(null)}
    );
}

// Misc

app.use("/runplannerDB", runplannerRoutes);
app.listen(PORT, function() {
    console.log("Server is running on Port: " + PORT);
});
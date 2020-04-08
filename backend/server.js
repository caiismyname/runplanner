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

let Workouts = require("./runplanner-workout.model");
let Users = require("./runplanner-user.model");
let WeeklyGoals = require("./runplanner-weeklyGoal.model");

app.use(cors());
app.use(bodyParser.json());

function proceedIfUserExists(id, successCallback, failureCallback) {
    Users.findOne({ _id: id }).select("_id").lean().then(result => {
        result ? successCallback() : failureCallback();
    }).catch(e => failureCallback());
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
            user.countdownConfig = req.body.countdownConfig;

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
    let promises = [];
    let fullWorkouts = [];

    for (let i = 0; i < req.body.toAdd.length; i++) {
        const w = req.body.toAdd[i];
        const promise = new Promise(function(resolve, reject) {
            proceedIfUserExists(w.owner, 
                (i) => {
                    let workout = new Workouts(w);
                    workout.save(function(err, workout) {
                        if (err) {
                            reject();
                        } else {
                            fullWorkouts.push(workout);
                            console.log("Adding workout: " + workout._id);
                            resolve();
                        }
                    });
                },
                () => {reject()}
            );
        });
        promises.push(promise);
    };

    Promise.all(promises).then(
        () => {
            // Add GCal event
            authorizeToGoogle(req.body.userID, fullWorkouts, res, addGCalEvents);
        }, 
        () => res.status(400).send("Adding new workout(s) failed")
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
    Object.keys(req.body.toUpdate).forEach((key,idx) => {
        let workoutToUpdate = req.body.toUpdate[key];
        Workouts.findById(workoutToUpdate.id, function(err, workout) {
            if (!workout) {
                res.status(404).send("Workout not found");
            } else {
                workout.payload = workoutToUpdate.payload;
                workout.owner = workoutToUpdate.owner;
                workout.gEventID = workoutToUpdate.gEventID;
    
                workout.save()
                    .then(workout => {res.json("Workout updated")})
                    .catch(err => {res.status(400).send("Workout update failed")});
            }
        });
    });
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
                    res.json(item);
                }           
            }
        }
    );
});

runplannerRoutes.route("/getworkoutsforownerfordaterange/:id/:gtedate/:ltedate").get(function(req, res) {
    Workouts.find(
        { 
            "payload.date": { 
                $gte: new Date(req.params.gtedate), 
                $lte: new Date(req.params.ltedate)
            },
            "owner": req.params.id
        },
        (err, items) => {
            if (err) {
                console.log(err);
            } else {
                let formattedItems = items.map(workout => { 
                    return {  
                        "payload": workout.payload,
                        "id": workout._id,
                        "gEventID": workout.gEventID,
                    }
                });
                res.json(formattedItems);
            }
        }
    );
})



//
//
// Google Calendar Access
//
//

function authorizeToGoogle(userID, workouts, res, callback) {
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
        callback(oAuth2Client, calendarID, timezone, defaultRunDuration, workouts, res);
    });
  }

function addGCalEvents(auth, calendarID, timezone, defaultRunDuration, workouts, res) {
    const calendar = google.calendar({version: 'v3', auth});
    let workoutsToReturn = [];
    let promises = [];
    workouts.forEach(workout => {
        const title = workout.payload.milage.goal === 0 
            ? "New run" 
            : workout.payload.milage.goal + " mile run";
        const promise = new Promise(function(resolve, reject) {
            calendar.events.insert({
                'calendarId': calendarID,
                'resource': {
                    'summary': title,
                    'start': {
                        'dateTime': workout.payload.date,
                        'timeZone': timezone
                    },
                    'end': {
                        'dateTime': moment(workout.payload.date).add(defaultRunDuration, "minutes").toISOString(),
                        'timeZone': timezone
                    }
                },
            }).then(event => {
                Workouts.findById(workout._id, function(err, workout) {
                    if (workout) {
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
                        console.log("Workout " + workout._id + " not found: " + err);
                    }
                });
            });
        });

        promises.push(promise);
    });

    Promise.all(promises).then(
        () => {
            res.status(200).json({
                "message": workoutsToReturn.length + " workout(s) added successfully", 
                "addedWorkouts": workoutsToReturn,
            })
        },
        () => res.status(400).send("Adding new workout(s) failed")
    );
}  

function updateGCalEvent(auth, calendarID) {

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

// Misc

app.use("/runplannerDB", runplannerRoutes);
app.listen(PORT, function() {
    console.log("Server is running on Port: " + PORT);
});
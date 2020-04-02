const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const cors = require("cors");
const mongoose = require("mongoose");
const runplannerRoutes = express.Router();
const PORT = 4000;

let Workouts = require("./runplanner-workout.model");
let Users = require("./runplanner-user.model");

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

//
//
// Workout CRUD operations
//
//

runplannerRoutes.route("/addworkouts").post(function(req, res) {
    var newIds = [];
    let promises = [];
    // Oh god. This assumes workout order will be preserved across all calls.
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
                            newIds.splice(i, 1, workout._id);
                            console.log("adding " + workout._id);
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
                "message": newIds.length + " workout(s) added successfully", 
                "ids": newIds,
            });
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
                workout.gEventId = workoutToUpdate.gEventId;
    
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
                        "gEventId": workout.gEventId,
                    }
                });
                res.json(formattedItems);
            }
        }
    );
})


// Misc

app.use("/runplannerDB", runplannerRoutes);
app.listen(PORT, function() {
    console.log("Server is running on Port: " + PORT);
});
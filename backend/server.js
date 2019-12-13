const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const cors = require("cors");
const mongoose = require("mongoose");
const runplannerRoutes = express.Router();
const PORT = 4000;
const moment = require("moment");

let Workouts = require("./runplanner-workout.model");
let Users = require("./runplanner-user.model");

app.use(cors());
app.use(bodyParser.json());

let serverDateFormat = "YYYY-MM-D";


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

runplannerRoutes.route("/deleteuser/:id").post(function(req, res) {
    // TODO: replace this with a function to check for existence that doesn't return the entire object
    Users.findById(req.params.id, function(err, user) {
        if (!user) {
            res.status(404).send("User not found");
        } else {
            Users.deleteOne({_id: req.params.id})
                .then(res.status(200).json("User deleted successfully"))
                .catch(err => {res.status(400).send("Deleting user failed")});
        }
    });
})

runplannerRoutes.route("/updateuser/:id").post(function(req, res) {
    Users.findById(req.params.id, function(err, user) {
        if (!user) {
            res.status(404).send("User not found");
        } else {
            user.name = req.body.name;
            user.config = req.body.config;
            user.countdownConfig = req.body.countdownConfig;

            user.save()
                .then(user => {res.status(200).json("User updated")})
                .catch(err => res.status(404).send("User update failed"));
        }
    })
})

//
//
// Workout CRUD operations
//
//

runplannerRoutes.route("/addworkouts").post(function(req, res) {
    let newIds = {};
    req.body.toAdd.forEach(w => {
        // TODO Validate that workout owner exists
        let workout = new Workouts(w);
        console.log("adding new workout ");

        workout.save(function(err, workout) {
            if (err) {
                res.status(400).send("Adding new workout failed");
            } else {
                newIds[w.date] = workout._id;

                res.status(200).json({
                    "message": "Workout added successfully", 
                    "id": workout._id,
                    "workout": workout,
                });
            }
        });
    })
});

// TODO I don't think POSTs should have the :id in the url but idk
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
    
                workout.save()
                    .then(workout => {res.json("Workout updated")})
                    .catch(err => {res.status(400).send("Workout update failed")});
            }
        });
    });
});

//
//
// GETs
//
//

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
            "payload.date": { $gte: new Date(req.params.gtedate), $lte: new Date(req.params.ltedate)},
            "owner": req.params.id
        },
        (err, items) => {
            if (err) {
                console.log(err);
            } else {
                let timeFormattedItems = items.map(workout => { 
                    return {  
                        "payload": workout.payload,
                        "id": workout._id,
                    }
                });
                res.json(timeFormattedItems);
            }
        }
    );
})

app.use("/runplannerDB", runplannerRoutes);
app.listen(PORT, function() {
    console.log("Server is running on Port: " + PORT);
});
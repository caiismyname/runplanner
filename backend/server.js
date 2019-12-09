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
            user.starts_on_monday = req.body.starts_on_monday;
            user.default_view = req.body.default_view;

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

runplannerRoutes.route("/addworkout").post(function(req, res) {
    let workout = new Workouts(req.body);

    // TODO Validate that workout owner exists

    workout.save()
        .then(workout => {res.status(200).json("Workout added successfully")})
        .catch(err => {res.status(400).send("Adding new workout failed")});
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

runplannerRoutes.route("/updateworkout/:id").post(function(req, res) {
    Workouts.findById(req.params.id, function(err, workout) {
        if (!workout) {
            res.status(404).send("Workout not found");
        } else {
            workout.owner = req.body.owner;
            workout.date = req.body.date;
            workout.payload = {
                "type": req.body.type,
                "content": req.body.content,
            }

            workout.save()
                .then(workout => {res.json("Workout updated")})
                .catch(err => {res.status(400).send("Workout update failed")});
        }
    })
});

//
//
// GETs
//
//

// runplannerRoutes.route("/getworkoutsforowner:id").get(function(req, res) {

// })

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
    console.log(new Date(req.params.gtedate));
    console.log(new Date(req.params.ltedate));
    Workouts.find(
        { 
            date: { $gte: new Date(req.params.gtedate), $lte: new Date(req.params.ltedate)},
            owner: req.params.id
        },
        (err, items) => {
            let timeFormattedItems = items.map(workout => { 
                return {  
                    "payload": workout["payload"],
                    "date": moment(workout["date"]).format(serverDateFormat),
                }
            });
            res.json(timeFormattedItems);
        }
    );
})

app.use("/runplannerDB", runplannerRoutes);
app.listen(PORT, function() {
    console.log("Server is running on Port: " + PORT);
});
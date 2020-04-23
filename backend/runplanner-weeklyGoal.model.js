const mongoose = require("mongoose");
const Schema = mongoose.Schema;

let WeeklyGoal = new Schema({
    payload: {
        goalType: {
            type: String,
            enum: ["weekly_mileage_goal", "weekly_time_goal"],
        },
        startDate: Date,
        endDate: Date,
        goalValue: Number,
    },
    ownerID: String,
});

module.exports = mongoose.model("WeeklyGoal", WeeklyGoal);
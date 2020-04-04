const mongoose = require("mongoose");
const Schema = mongoose.Schema;

let WeeklyGoal = new Schema({
    ownerID: String,
    goalType: {
        type: String,
        enum: ["weekly_milage_goal", "weekly_time_goal"],
    },
    startDate: Date,
    endDate: Date,
    goalValue: Number,
});

module.exports = mongoose.model("WeeklyGoal", WeeklyGoal);
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

let User = new Schema({
    _id: String,
    calendarId: String,
    config: {
        startingDayOfWeek: {
            type: Number,
            min: 0,
            max: 6
        },
        defaultView: {
            type: String,
            enum: ["calendar", "countdown"]
        },
        mainTimezone: String,
        defaultRunDuration: { // in minutes
            type: Number,
            min: 1,
        },
    },
    countdownConfig: {
        deadline: {
            type: Date,
        }
    }
});

module.exports = mongoose.model("User", User);
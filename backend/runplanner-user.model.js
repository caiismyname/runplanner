const mongoose = require("mongoose");
const Schema = mongoose.Schema;

let User = new Schema({
    _id: String,
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
    },
    countdownConfig: {
        deadline: {
            type: Date,
        }
    }
});

module.exports = mongoose.model("User", User);
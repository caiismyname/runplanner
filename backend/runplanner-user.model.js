const mongoose = require("mongoose");
const Schema = mongoose.Schema;

let User = new Schema({
    _id: String,
    calendarID: String,
    config: {
        startingDayOfWeek: {
            type: Number, // 0 is Sunday
            min: 0,
            max: 6
        },
        defaultStartTime: { // This should be used in conjuction with the mainTimezone 
            hour: Number, // 24 hour time
            minute: Number,
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
        autofillConfig: {
            distribution: {
                type: String,
                enum: ["Even", "Random", "Pyramid", "StaircaseUp", "StaircaseDown"]
            }
        },
        countdownConfig: { 
            deadline: Date,
        },
    },
    gTokens: {
        accessToken: {
            type: String,
            // required: [true, 'User must have an accessToken to enable server-side event creation']
        },
        refreshToken: {
            type: String,
            // required: [true, 'User must have an accessToken to enable server-side event creation']
        }
    }
});

module.exports = mongoose.model("User", User);
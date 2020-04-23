const mongoose = require("mongoose");
const Schema = mongoose.Schema;

let Workout = new Schema({
    owner: {
        type: String,
        required: [true, "Workouts must have owners"],
    },
    gEventID: String,
    payload: {
        type: {
            type: String,
            enum: ["None", "Workout", "Recovery", "Long Run", "Race"]
        },
        content: {
            type: String,
        },
        startDate: {
            // This is technically a datetime
            type: Date,
        },
        milage: {
            goal: {
                type: Number,
            },
            actual: {
                type: Number,
            },
        },
        creationType: {
            type: String,
            enum: ["owner", "autofillWeek", "repeatingWorkout"],
        }
    }
});

module.exports = mongoose.model("Workout", Workout);
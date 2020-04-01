const mongoose = require("mongoose");
const Schema = mongoose.Schema;

let Workout = new Schema({
    owner: {
        type: String,
        required: [true, "Workouts must have owners"],
    },
    gEventId: {
        type: String,
        required: [true, "Each workout must be connected to a Google Calendar Event"],
    },
    payload: {
        type: {
            type: String,
            // enum: ["None", "Workout", "Recovery", "Long Run", "Race"]
        },
        content: {
            type: String,
        },
        date: {
            type: Date,
        },
    }
});

module.exports = mongoose.model("Workout", Workout);
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

let Workout = new Schema({
    owner: {
        type: String,
        required: [true, "Workouts must have owners"]
    },
    date: {
        type: Date,
    },
    payload: {
        type: {
            type: String,
            enum: ["Workout", "Recovery", "Long Run", "Race"]
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
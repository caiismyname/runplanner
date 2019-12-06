const mongoose = require("mongoose");
const Schema = mongoose.Schema;

let Workout = new Schema({
    workout_owner: {
        type: String,
        required: [true, "Workouts must have owners"]
    },
    workout_date: {
        type: Date,
    },
    workout_type: {
        type: String,
        enum: ["Workout", "Recovery", "Long Run", "Race"]
    },
    workout_content: {
        type: String,
    }
});

module.exports = mongoose.model("Workout", Workout);
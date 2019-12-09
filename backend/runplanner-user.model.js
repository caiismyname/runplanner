const mongoose = require("mongoose");
const Schema = mongoose.Schema;

let User = new Schema({
    name: String,
    config: {
        startsOnMonday: Boolean,
        defaultView: {
            type: String,
            enum: ["calendar", "countdown"]
        }
    },
    countdownConfig: {
        deadline: {
            type: Date,
        }
    }
});

module.exports = mongoose.model("User", User);
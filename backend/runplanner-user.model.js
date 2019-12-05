const mongoose = require("mongoose");
const Schema = mongoose.Schema;

let User = new Schema({
    name: String,
    config: {
        starts_on_monday: Boolean,
        default_view: {
            type: String,
            enum: ["calendar", "countdown"]
        }
    }
});

module.exports = mongoose.model("User", User);
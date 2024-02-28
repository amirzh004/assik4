const mongoose = require("mongoose");

const photoSchema = new mongoose.Schema({
    userId: String,
    photoURL: String,
}, { timestamps: true });

const Photo = mongoose.model("Photo", photoSchema);

module.exports = Photo;

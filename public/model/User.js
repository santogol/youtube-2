// public/model/User.js
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const UserSchema = new mongoose.Schema({
  nome: {
    type: String,
    required: true,
    minlength: 2,
    maxlength: 30
  },
  username: {
    type: String,
    required: true,
    unique: true,
    minlength: 3,
    maxlength: 20
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  bio: {
    type: String,
    default: "",
    maxlength: 150
  },
  profilePic: {
    data: Buffer,
    contentType: String
  },
  followers: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Utente"
    }
  ],
  following: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Utente"
    }
  ],
  utentiRecenti: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Utente"
    }
  ]
}, { timestamps: true });

// Hash della password prima di salvare
UserSchema.pre("save", async function(next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Metodo per confrontare le password
UserSchema.methods.matchPassword = function(enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("Utente", UserSchema);

const mongoose = require("mongoose");

const CommentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Utente",
    required: true
  },
  text: {
    type: String,
    required: true,
    maxlength: 200
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const PostSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Utente",
      required: true
    },
    desc: {
      type: String,
      maxlength: 500,
      default: ""
    },
    Image: {
      type: String
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Utente"
      }
    ],
    comments: [CommentSchema]
  },
  { timestamps: true }
);

// Elimina automaticamente i post 24h dopo createdAt
PostSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 });

module.exports = mongoose.model("Post", PostSchema);

require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcrypt");
const path = require("path");
const multer = require("multer");
const session = require("express-session");
const csrf = require("csurf");
const cookieParser = require("cookie-parser");
const { OAuth2Client } = require("google-auth-library");

const CLIENT_ID = '42592859457-ausft7g5gohk7mf96st2047ul9rk8o0v.apps.googleusercontent.com';
const client = new OAuth2Client(CLIENT_ID);

const app = express();
app.set('trust proxy', 1);

function getFingerprint(req) {
  return req.headers['user-agent'] || '';
}

function checkFingerprint(req, res, next) {
  if (!req.session.user) return res.status(401).json({ message: "Non autorizzato" });

  const currentFp = getFingerprint(req);
  const savedFp = req.session.fingerprint;

  if (!savedFp) {
    req.session.fingerprint = currentFp;
    return next();
  }

  if (savedFp !== currentFp) {
    req.session.destroy(err => {
      if (err) console.error("Errore distruggendo sessione:", err);
      return res.status(403).json({ message: "Sessione invalida, effettua di nuovo il login." });
    });
  } else {
    next();
  }
}

app.use(cors({
  origin: 'https://bepoli.onrender.com',
  credentials: true
}));
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    maxAge: 1000 * 60 * 30,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  }
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const csrfProtection = csrf({ cookie: false });

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connesso a MongoDB"))
  .catch(err => console.error("❌ Connessione fallita:", err));

const utenteSchema = new mongoose.Schema({
  nome: String,
  username: { type: String, unique: true },
  password: String,
  bio: String,
  profilePic: {
    data: Buffer,
    contentType: String
  },
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "Utente" }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: "Utente" }],
  utentiRecenti: [{ type: mongoose.Schema.Types.ObjectId, ref: "Utente" }]
});
const Utente = mongoose.model("Utente", utenteSchema);

const postSchema = new mongoose.Schema({
  autore: { type: mongoose.Schema.Types.ObjectId, ref: "Utente", required: true },
  immagine: {
    data: Buffer,
    contentType: String
  },
  didascalia: String,
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Utente" }],
  commenti: [{
    autore: { type: mongoose.Schema.Types.ObjectId, ref: "Utente" },
    testo: String,
    timestamp: { type: Date, default: Date.now }
  }],
  timestamp: { type: Date, default: Date.now }
});
const Post = mongoose.model("Post", postSchema);

const storage = multer.memoryStorage();
const upload = multer({ storage });

// --- Endpoint per creare un post ---
app.post("/api/post", checkFingerprint, csrfProtection, upload.single("immagine"), async (req, res) => {
  try {
    const userId = req.session.user.id;

    if (!req.file) {
      return res.status(400).json({ message: "Immagine mancante" });
    }

    const nuovoPost = new Post({
      autore: userId,
      immagine: {
        data: req.file.buffer,
        contentType: req.file.mimetype
      },
      didascalia: req.body.didascalia || ""
    });

    await nuovoPost.save();

    res.status(201).json({ message: "Post creato con successo" });
  } catch (err) {
    console.error("Errore creazione post:", err);
    res.status(500).json({ message: "Errore interno" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server attivo su porta ${PORT}`);
});

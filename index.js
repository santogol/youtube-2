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

// Import del nuovo router per i post
const postRoutes = require("./routes/posts");

const CLIENT_ID = '42592859457-ausft7g5gohk7mf96st2047ul9rk8o0v.apps.googleusercontent.com';
const client = new OAuth2Client(CLIENT_ID);

const app = express();
app.set('trust proxy', 1);

// --- Funzione Fingerprint ---
function getFingerprint(req) {
  return req.headers['user-agent'] || '';
}

// --- Middleware fingerprint ---
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

// --- Middleware generali ---
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
// Per parsing application/x-www-form-urlencoded (necessario per form non-multipart)
app.use(express.urlencoded({ extended: true }));
// Serve i file statici da public/
app.use(express.static(path.join(__dirname, "public")));

// ---------- NUOVE INTEGRAZIONI ----------
// Serve le immagini caricate dei post
app.use("/uploads/postImages", express.static(path.join(__dirname, "uploads/postImages")));

// Monta le rotte per i post (create/read/like/comment)
app.use("/api/posts", postRoutes);
// ----------------------------------------

// CSRF protection
const csrfProtection = csrf({ cookie: false });

// --- DB ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connesso a MongoDB"))
  .catch(err => console.error("❌ Connessione fallita:", err));

// --- Schemi Utente (restano invariati) ---
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

// Multer in memory per upload foto profilo
const storage = multer.memoryStorage();
const upload = multer({ storage });

// --- Rotte esistenti (login, register, profilo, ecc.) ---

app.get("/csrf-token", (req, res, next) => {
  req.session.touch();
  next();
}, csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/login.html"));
});

app.post("/login", csrfProtection, async (req, res) => {
  /* ... login tradizionale ... */
});

app.post("/auth/google", async (req, res) => {
  /* ... login Google ... */
});

app.post("/register", csrfProtection, async (req, res) => {
  /* ... registrazione ... */
});

app.post("/api/update-profile", checkFingerprint, csrfProtection, upload.single("profilePic"), async (req, res) => {
  /* ... modifica profilo ... */
});

app.get("/api/user-photo/:userId", async (req, res) => {
  /* ... serve foto profilo ... */
});

app.get("/api/search-users", checkFingerprint, async (req, res) => {
  /* ... ricerca utenti ... */
});

app.post("/api/visit-user/:id", checkFingerprint, async (req, res) => {
  /* ... salva utente visitato ... */
});

app.get("/api/recent-users", checkFingerprint, async (req, res) => {
  /* ... recupera utenti recenti ... */
});

app.get("/api/user/:id/followers", checkFingerprint, async (req, res) => {
  /* ... lista followers ... */
});

app.get("/api/user/:id/following", checkFingerprint, async (req, res) => {
  /* ... lista following ... */
});

app.get("/api/user-public/:id", async (req, res) => {
  /* ... profilo pubblico ... */
});

app.post("/api/follow/:id", checkFingerprint, async (req, res) => {
  /* ... follow/unfollow ... */
});

app.get("/api/follow-info/:id", checkFingerprint, async (req, res) => {
  /* ... info follow ... */
});

app.get("/api/user", checkFingerprint, async (req, res) => {
  /* ... utente autenticato ... */
});

app.post("/logout", checkFingerprint, csrfProtection, (req, res) => {
  /* ... logout ... */
});

// --- Avvio server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server attivo su porta ${PORT}`);
});

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

// ✅ Route di base (homepage)
app.get("/", (req, res) => {
  res.send("API BePoli attiva ✅");
});

// ✅ Route creazione post
app.post("/api/post", checkFingerprint, upload.single("immagine"), async (req, res) => {
  try {
    if (!req.file || !req.body.didascalia) {
      return res.status(400).json({ message: "Immagine e didascalia richieste." });
    }

    const nuovoPost = new Post({
      autore: req.session.user._id,
      immagine: {
        data: req.file.buffer,
        contentType: req.file.mimetype
      },
      didascalia: req.body.didascalia
    });

    await nuovoPost.save();
    res.status(201).json({ message: "Post creato!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Errore nella creazione del post" });
  }
});

// ✅ Metti/togli like a un post
app.post("/api/post/:id/like", checkFingerprint, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post non trovato" });

    const userId = req.session.user._id;
    const haGiaMessoLike = post.likes.includes(userId);

    if (haGiaMessoLike) {
      post.likes.pull(userId);
    } else {
      post.likes.push(userId);
    }

    await post.save();
    res.json({ liked: !haGiaMessoLike, totalLikes: post.likes.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Errore nel mettere like" });
  }
});

// ✅ Aggiungi un commento a un post
app.post("/api/post/:id/comment", checkFingerprint, async (req, res) => {
  try {
    const { testo } = req.body;
    const postId = req.params.id;

    if (!testo || testo.trim() === "") {
      return res.status(400).json({ message: "Il commento non può essere vuoto." });
    }

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ message: "Post non trovato" });

    const utente = await Utente.findById(req.session.user._id).select("username");
    if (!utente) return res.status(401).json({ message: "Utente non valido" });

    const nuovoCommento = {
      autore: utente._id,
      testo,
      timestamp: new Date()
    };

    post.commenti.push(nuovoCommento);
    await post.save();

    res.status(201).json({
      autore: { username: utente.username },
      testo
    });
  } catch (err) {
    console.error("Errore nel commento:", err);
    res.status(500).json({ message: "Errore interno" });
  }
});
// ✅ Route per ottenere tutti i post (usata nella home)
app.get("/api/posts", async (req, res) => {
  try {
    const posts = await Post.find()
      .sort({ timestamp: -1 })
      .populate("autore", "username profilePic")
      .populate("commenti.autore", "username");

    const simplifiedPosts = posts.map(post => ({
      id: post._id,
      didascalia: post.didascalia,
      timestamp: post.timestamp,
      autore: {
        username: post.autore.username,
        profilePicUrl: `/profile-pic/${post.autore._id}`
      },
      immagineUrl: `/api/post-img/${post._id}`,
      commenti: post.commenti.map(commento => ({
        username: commento.autore?.username || "Anonimo",
        testo: commento.testo,
        timestamp: commento.timestamp
      }))
    }));

    res.json(simplifiedPosts); // ✅ MANCAVA QUESTA RIGA
  } catch (err) {
    console.error("Errore nel recupero post:", err);
    res.status(500).json({ message: "Errore interno" });
  }
});

// ✅ Route per servire immagine post
app.get("/api/post-img/:id", async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post || !post.immagine || !post.immagine.data) {
      return res.status(404).send("Immagine non trovata");
    }

    res.set("Content-Type", post.immagine.contentType);
    res.send(post.immagine.data);
  } catch (err) {
    console.error("Errore caricamento immagine:", err);
    res.status(500).send("Errore interno");
  }
});

// ✅ Route per immagine profilo
app.get("/profile-pic/:id", async (req, res) => {
  try {
    const utente = await Utente.findById(req.params.id);
    if (utente?.profilePic?.data) {
      res.set("Content-Type", utente.profilePic.contentType);
      return res.send(utente.profilePic.data);
    } else {
      return res.redirect("/fotoprofilo.png");
    }
  } catch (err) {
    console.error("Errore caricamento foto profilo:", err);
    return res.redirect("/fotoprofilo.png");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server attivo su porta ${PORT}`);
});

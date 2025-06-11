const router = require("express").Router();
const mongoose = require("mongoose");
const Post = require("../model/Post");
const Utente = mongoose.model("Utente");
const path = require("path");
const multer = require("multer");

// Fingerprint/session middleware (come in index.js)
function getFingerprint(req) { return req.headers["user-agent"] || ""; }
function checkFingerprint(req, res, next) {
  if (!req.session.user) return res.status(401).json({ message: "Non autorizzato" });
  const saved = req.session.fingerprint, cur = getFingerprint(req);
  if (!saved) { req.session.fingerprint = cur; return next(); }
  if (saved !== cur) {
    req.session.destroy(err => res.status(403).json({ message: "Sessione invalida" }));
  } else next();
}

// Configurazione Multer per upload immagini post
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, "../uploads/postImages")),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, req.session.user.id + "_" + Date.now() + ext);
  }
});
const upload = multer({ storage });

// CREA UN NUOVO POST
router.post("/", checkFingerprint, upload.single("image"), async (req, res) => {
  try {
    const newPost = new Post({
      userId: req.session.user.id,
      desc: req.body.desc || "",
      Image: req.file ? "/uploads/postImages/" + req.file.filename : ""
    });
    await newPost.save();
    await newPost.populate("userId", "username profilePic");
    res.status(201).json(newPost);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Errore creazione post" });
  }
});

// LISTA FEED
router.get("/", checkFingerprint, async (req, res) => {
  try {
    const posts = await Post.find()
      .populate("userId", "username profilePic")
      .sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Errore caricamento post" });
  }
});

// LIKE / DISLIKE
router.put("/:id/like", checkFingerprint, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post non trovato" });
    const uid = req.session.user.id;
    const idx = post.likes.indexOf(uid);
    if (idx === -1) post.likes.push(uid);
    else post.likes.splice(idx, 1);
    await post.save();
    res.json({ likes: post.likes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Errore like" });
  }
});

// AGGIUNGI COMMENTO
router.post("/:id/comments", checkFingerprint, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ message: "Commento vuoto" });
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post non trovato" });
    post.comments.push({ userId: req.session.user.id, text });
    await post.save();
    res.status(201).json(post.comments.slice(-1)[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Errore commento" });
  }
});

module.exports = router;

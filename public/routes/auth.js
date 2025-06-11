// public/routes/auth.js
const router = require("express").Router();
const mongoose = require("mongoose");
const Utente = mongoose.model("Utente");
const bcrypt = require("bcrypt");
const csrf = require("csurf");

const csrfProtection = csrf({ cookie: false });

function getFingerprint(req) {
  return req.headers["user-agent"] || "";
}

function checkFingerprint(req, res, next) {
  if (!req.session.user) return res.status(401).json({ message: "Non autorizzato" });
  const saved = req.session.fingerprint;
  const cur = getFingerprint(req);
  if (!saved) {
    req.session.fingerprint = cur;
    return next();
  }
  if (saved !== cur) {
    return req.session.destroy(err => {
      if (err) console.error(err);
      res.status(403).json({ message: "Sessione invalida" });
    });
  }
  next();
}

router.post("/register", csrfProtection, async (req, res) => {
  const { nome, username, password } = req.body;
  if (!nome || !username || !password)
    return res.status(400).json({ message: "Dati mancanti" });
  try {
    if (await Utente.findOne({ username }))
      return res.status(400).json({ message: "Username già esistente" });
    const hash = await bcrypt.hash(password, 10);
    const newUtente = new Utente({
      nome,
      username,
      password: hash,
      bio: "",
      profilePic: { data: null, contentType: null }
    });
    await newUtente.save();
    req.session.user = { id: newUtente._id, nome: newUtente.nome, username: newUtente.username };
    req.session.fingerprint = getFingerprint(req);
    res.status(201).json({ message: "Registrazione completata", user: req.session.user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Errore server" });
  }
});

router.post("/login", csrfProtection, async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ message: "Dati mancanti" });
  try {
    const utente = await Utente.findOne({ username });
    if (!utente || !(await bcrypt.compare(password, utente.password))) {
      return res.status(400).json({ message: "Username o password errati" });
    }
    req.session.user = { id: utente._id, nome: utente.nome, username: utente.username };
    req.session.fingerprint = getFingerprint(req);
    res.json({ message: "Login riuscito", user: req.session.user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Errore server" });
  }
});

router.post("/logout", checkFingerprint, csrfProtection, (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ message: "Errore logout" });
    res.clearCookie("connect.sid");
    res.json({ message: "Logout effettuato" });
  });
});

module.exports = router;

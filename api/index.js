const express = require("express");
const app = express();
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const helmet = require("helmet");
const morgan = require("morgan");
const multer = require("multer");
const userRoute = require("./routes/users");
const authRoute = require("./routes/auth");
const postRoute = require("./routes/posts");
const path = require("path");

dotenv.config();

// Sostituisci process.env.MONGO_URL con la tua stringa di connessione
mongoose.connect(
  process.env.MONGO_URL,
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
)
.then(() => console.log("Connesso a MongoDB"))
.catch((err) => console.error("Errore connessione MongoDB:", err));

// Configurazione di multer (esempio base; adatta storage a seconda delle tue esigenze)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public-images"); // cartella di destinazione per le immagini uploadate
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage: storage });

app.post("/api/upload", upload.single("file"), (req, res) => {
  try {
    return res.status(200).json("File caricato con successo");
  } catch (error) {
    console.error(error);
    return res.status(500).json("Errore durante l’upload");
  }
});

app.use(express.json());
app.use("/api/auth", authRoute);
app.use("/api/users", userRoute);
app.use("/api/posts", postRoute);

// Se vuoi servire le immagini staticamente
app.use("/public-images", express.static(path.join(__dirname, "public-images")));

app.listen(8800, () => {
  console.log("Backend server is running on port 8800!");
});

const router = require("express").Router();
const Post = require("../model/post");
const { isAuthenticated } = require("../middleware/authMiddleware");

// Create a post
router.post("/", isAuthenticated, async (req, res) => {
  const newPost = new Post({
    userId: req.user._id,
    desc: req.body.desc,
    Image: req.body.Image || "",
  });
  try {
    const savedPost = await newPost.save();
    res.status(201).json(savedPost);
  } catch (err) {
    res.status(500).json({ message: "Errore nella creazione del post", error: err });
  }
});

// Update a post
router.put("/:id", isAuthenticated, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post non trovato" });

    if (post.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Puoi modificare solo i tuoi post" });
    }

    post.desc = req.body.desc || post.desc;
    post.Image = req.body.Image || post.Image;
    const updated = await post.save();
    res.status(200).json(updated);
  } catch (err) {
    res.status(500).json({ message: "Errore aggiornando il post", error: err });
  }
});

// Delete a post
router.delete("/:id", isAuthenticated, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post non trovato" });

    if (post.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Puoi eliminare solo i tuoi post" });
    }

    await post.deleteOne();
    res.status(200).json({ message: "Post eliminato" });
  } catch (err) {
    res.status(500).json({ message: "Errore eliminando il post", error: err });
  }
});

// Like / dislike a post
router.put("/:id/like", isAuthenticated, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post non trovato" });

    const userId = req.user._id.toString();
    if (!post.likes.includes(userId)) {
      post.likes.push(userId);
      await post.save();
      return res.status(200).json({ liked: true });
    } else {
      post.likes = post.likes.filter(id => id !== userId);
      await post.save();
      return res.status(200).json({ liked: false });
    }
  } catch (err) {
    res.status(500).json({ message: "Errore nel like/dislike", error: err });
  }
});

// Get a post
router.get("/:id", async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post non trovato" });
    res.status(200).json(post);
  } catch (err) {
    res.status(500).json({ message: "Errore recuperando il post", error: err });
  }
});

// Get posts for timeline
router.get("/timeline/all", isAuthenticated, async (req, res) => {
  try {
    const posts = await Post.find({}).sort({ createdAt: -1 });
    res.status(200).json(posts);
  } catch (err) {
    res.status(500).json({ message: "Errore nella timeline", error: err });
  }
});

module.exports = router;

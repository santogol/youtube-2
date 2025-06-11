const user = JSON.parse(sessionStorage.getItem("user") || "{}");
if (!user._id) window.location.href = "login.html";

const template = document.getElementById("post-template");
const feed = document.getElementById("feed");
const form = document.getElementById("createPostForm");
const descIn = document.getElementById("postDescInput");
const imgIn = document.getElementById("postImageInput");
const errDiv = document.getElementById("createPostError");
const logout = document.getElementById("logoutLink");

logout.addEventListener("click", async e => {
  e.preventDefault();
  await fetch("/logout", { method:"POST", credentials:"include" });
  sessionStorage.removeItem("user");
  window.location.href = "login.html";
});

form.addEventListener("submit", async e => {
  e.preventDefault();
  errDiv.classList.add("hidden");
  const desc = descIn.value.trim();
  const file = imgIn.files[0];
  if (!desc && !file) {
    errDiv.textContent = "Inserisci descrizione o seleziona un'immagine.";
    return errDiv.classList.remove("hidden");
  }
  const data = new FormData();
  if (desc) data.append("desc", desc);
  if (file) data.append("image", file);
  const res = await fetch("/api/posts", { method:"POST", credentials:"include", body:data });
  if (!res.ok) {
    errDiv.textContent = "Errore creazione post.";
    return errDiv.classList.remove("hidden");
  }
  const p = await res.json();
  feed.prepend(renderPost(p));
  descIn.value = "";
  imgIn.value = "";
});

async function loadPosts() {
  const res = await fetch("/api/posts", { credentials:"include" });
  if (!res.ok) return feed.innerHTML="<p>Errore caricamento.</p>";
  const arr = await res.json();
  feed.innerHTML = "";
  arr.forEach(p => feed.appendChild(renderPost(p)));
}

function renderPost(p) {
  const clone = template.content.cloneNode(true);
  const el = clone.querySelector(".post-card");
  el.querySelector(".post-username").textContent = p.userId.username;
  el.querySelector(".post-date").textContent = new Date(p.createdAt).toLocaleString("it-IT", {
    day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"
  });
  const img = el.querySelector(".post-image");
  img.src = p.Image;
  el.querySelector(".post-desc-text").textContent = p.desc || "";

  const likeBtn = el.querySelector(".like-button");
  const likeCount = el.querySelector(".like-count");
  likeCount.textContent = p.likes.length;
  likeBtn.addEventListener("click", async () => {
    const r = await fetch(`/api/posts/${p._id}/like`, { method:"PUT", credentials:"include" });
    if (!r.ok) return alert("Errore like");
    const data = await r.json();
    p.likes = data.likes;
    likeCount.textContent = p.likes.length;
  });

  const toggle = el.querySelector(".comment-toggle-button");
  const sec = el.querySelector(".comment-section");
  const list = el.querySelector(".comments-list");
  const cform = el.querySelector(".comment-form");
  const cinput = el.querySelector(".comment-input");
  toggle.addEventListener("click", () => sec.classList.toggle("hidden"));
  cform.addEventListener("submit", async e => {
    e.preventDefault();
    if(!cinput.value.trim()) return;
    const r = await fetch(`/api/posts/${p._id}/comments`, {
      method:"POST",
      credentials:"include",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ text:cinput.value.trim() })
    });
    if(!r.ok) return alert("Errore commento");
    const cm = await r.json();
    const li = document.createElement("li");
    li.innerHTML = `<span class="comment-author">${cm.userId}</span>${cm.text}`;
    list.prepend(li);
    cinput.value = "";
  });

  return el;
}

window.addEventListener("DOMContentLoaded", loadPosts);

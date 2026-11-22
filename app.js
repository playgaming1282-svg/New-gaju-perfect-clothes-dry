// CLOTH DRY SYSTEM PUNE — Firebase-enabled gallery/admin starter
// 1) Create a Firebase project. Enable Authentication > Email/Password,
//    Firestore Database and Storage.
// 2) Paste your Firebase web config below. Create your admin user in Firebase Auth.
// 3) Publish the included Firestore and Storage rules (firebase-rules.txt).
// Without Firebase config, the public website and WhatsApp/call buttons still work.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

const firebaseConfig = {
  apiKey: "PASTE_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
const configured = firebaseConfig.apiKey !== "PASTE_FIREBASE_API_KEY" &&
                   firebaseConfig.projectId !== "YOUR_PROJECT_ID";

const $ = (id) => document.getElementById(id);
$("year").textContent = new Date().getFullYear();
$("menuToggle").addEventListener("click", () => $("mainNav").classList.toggle("open"));
document.querySelectorAll("#mainNav a").forEach(a => a.addEventListener("click", () => $("mainNav").classList.remove("open")));

const dialog = $("adminDialog");
$("adminOpen").addEventListener("click", () => dialog.showModal());
$("toast").textContent = "";
function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  setTimeout(() => $("toast").classList.remove("show"), 2600);
}
let app, auth, db, storage;
if (configured) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app); db = getFirestore(app); storage = getStorage(app);
    onAuthStateChanged(auth, user => {
      $("adminLogin").hidden = !!user;
      $("adminPanel").hidden = !user;
      if (user) loadPhotos();
    });
    loadPhotos();
  } catch (e) { console.error("Firebase init:", e); }
}

$("loginBtn").addEventListener("click", async () => {
  if (!configured) { $("adminMessage").textContent = "Firebase config is not set. Add your project details in app.js first."; return; }
  try {
    await signInWithEmailAndPassword(auth, $("adminEmail").value.trim(), $("adminPassword").value);
    $("adminMessage").textContent = "";
  } catch (e) { $("adminMessage").textContent = friendlyError(e); }
});
$("logoutBtn").addEventListener("click", async () => { if (auth) await signOut(auth); });
$("uploadBtn").addEventListener("click", async () => {
  const file = $("photoFile").files[0];
  if (!configured || !auth?.currentUser) { toast("Please connect Firebase and sign in first."); return; }
  if (!file || !file.type.startsWith("image/")) { toast("Please select an image file."); return; }
  if (file.size > 8 * 1024 * 1024) { toast("Image must be under 8 MB."); return; }
  $("uploadBtn").disabled = true; $("uploadBtn").textContent = "Uploading…";
  try {
    const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"-")}`;
    const imageRef = ref(storage, `gallery/${safeName}`);
    await uploadBytes(imageRef, file, { contentType: file.type });
    const url = await getDownloadURL(imageRef);
    await addDoc(collection(db, "gallery"), {
      title: $("photoTitle").value.trim() || "Cloth drying stand",
      url, storagePath: `gallery/${safeName}`, createdAt: serverTimestamp()
    });
    $("photoFile").value = ""; $("photoTitle").value = "";
    toast("Photo uploaded successfully."); await loadPhotos();
  } catch (e) { toast(friendlyError(e)); }
  finally { $("uploadBtn").disabled = false; $("uploadBtn").textContent = "Upload photo"; }
});

async function loadPhotos() {
  if (!configured || !db) return;
  try {
    const snap = await getDocs(query(collection(db, "gallery"), orderBy("createdAt", "desc")));
    const grid = $("galleryGrid");
    const photos = snap.docs.map(d => ({id:d.id, ...d.data()}));
    if (photos.length) {
      grid.innerHTML = photos.map(p => `<figure class="uploaded-tile"><img src="${escapeAttr(p.url)}" alt="${escapeAttr(p.title || "Cloth drying stand photo")}" loading="lazy"><figcaption>${escapeHtml(p.title || "Product photo")}</figcaption></figure>`).join("");
    }
    if (auth?.currentUser) {
      $("adminPhotos").innerHTML = photos.map(p => `<p>${escapeHtml(p.title || "Photo")} <button type="button" data-delete="${p.id}" data-path="${escapeAttr(p.storagePath || "")}">Delete</button></p>`).join("");
      $("adminPhotos").querySelectorAll("[data-delete]").forEach(btn => btn.addEventListener("click", () => removePhoto(btn.dataset.delete, btn.dataset.path)));
    }
  } catch (e) { console.warn("Gallery not loaded:", e); }
}
async function removePhoto(id, path) {
  if (!confirm("Delete this gallery photo?")) return;
  try {
    await deleteDoc(doc(db, "gallery", id));
    if (path) { try { await deleteObject(ref(storage, path)); } catch (_) {} }
    toast("Photo deleted."); await loadPhotos();
  } catch (e) { toast(friendlyError(e)); }
}
function friendlyError(e) {
  const code = e?.code || "";
  if (code.includes("auth/invalid-credential")) return "Email or password is incorrect.";
  if (code.includes("permission-denied")) return "Permission denied. Check Firebase rules and admin sign-in.";
  return e?.message || "Something went wrong. Please try again.";
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function escapeAttr(s) { return escapeHtml(s).replace(/`/g, "&#96;"); }

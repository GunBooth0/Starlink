// ===== Starlink — Firebase configuration =====
// 1. Go to https://console.firebase.google.com, create a project.
// 2. Add a "Web app" to the project (</> icon) and copy the config object
//    it gives you, then paste the values in below.
// 3. In the Firebase console, enable Authentication -> Sign-in method -> Email/Password.
// 4. In the Firebase console, create a Firestore database (production mode)
//    and paste the contents of firestore.rules into Firestore -> Rules.
// See README.md for the full setup walkthrough, including how to make
// your own account the owner.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB86FEjEuuO-vm_9YMEwCN5cKMa4XuULTY",
  authDomain: "starlink-9398b.firebaseapp.com",
  projectId: "starlink-9398b",
  storageBucket: "starlink-9398b.firebasestorage.app",
  messagingSenderId: "168571485561",
  appId: "1:168571485561:web:9c64652b03648b1d9943a8",
  measurementId: "G-E1E09WRXQY"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

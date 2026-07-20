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
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

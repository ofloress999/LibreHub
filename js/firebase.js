// js/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDbrC3mCUanKM57ZGEO_tOx21MTbH8k3Xg",
  authDomain: "biblioteca-22a1c.firebaseapp.com",
  projectId: "biblioteca-22a1c",
  storageBucket: "biblioteca-22a1c.firebasestorage.app",
  messagingSenderId: "724579681860",
  appId: "1:724579681860:web:830a4d9acf94366c27de11"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);

// Exporta as instâncias para usar nos outros arquivos .js
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
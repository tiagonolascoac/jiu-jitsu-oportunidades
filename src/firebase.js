import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

export const firebaseConfig = {
  apiKey: "AIzaSyBoRHRTLfYXr3Y_tlKTSiEFabIkm2d_IOE",
  authDomain: "jiu-jitsu-oportunidades.firebaseapp.com",
  projectId: "jiu-jitsu-oportunidades",
  storageBucket: "jiu-jitsu-oportunidades.firebasestorage.app",
  messagingSenderId: "1009060637650",
  appId: "1:1009060637650:web:da6d6cc70bb7cff4ddb60b",
  measurementId: "G-3VXJZJCFY4"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;

import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import firebaseConfig from "../firebaseConfig";

/** Single Firebase app shared by the auth and firestore services. */
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);

/**
 * In the browser Firestore keeps a copy of the user's data on this device. Reads
 * then work offline, and writes made offline are queued and sent when the
 * connection comes back. On the server (pre-rendering) there is no storage.
 */
function openDb() {
  if (typeof window === "undefined") return getFirestore(app);
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    // Already initialised (hot reload), or this browser has no usable storage.
    return getFirestore(app);
  }
}

export const db = openDb();

import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  getDocsFromCache,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type DocumentData,
  type QueryConstraint,
  type Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../firebase";

/** Fields every stored document gets automatically. */
export interface Timestamps {
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

/** A stored document plus its id. */
export type Stored<T> = T & Timestamps & { id: string };

/**
 * Generic CRUD over any collection path, e.g. "users" or "users/abc/messageState".
 * Domain modules (users.ts, messageState.ts) wrap these with typed, named functions.
 */

/** Create. Pass an `id` to choose the document id, otherwise Firestore generates one. */
export async function create<T extends DocumentData>(
  path: string,
  data: T,
  id?: string,
): Promise<string> {
  const stamped = {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (id) {
    await setDoc(doc(db, path, id), stamped);
    return id;
  }
  return (await addDoc(collection(db, path), stamped)).id;
}

/** Read one document, or null when it doesn't exist. */
export async function get<T extends DocumentData>(
  path: string,
  id: string,
): Promise<Stored<T> | null> {
  const snap = await getDoc(doc(db, path, id));
  return snap.exists() ? ({ ...snap.data(), id: snap.id } as Stored<T>) : null;
}

/** Read a collection, optionally filtered or ordered with query constraints. */
export async function list<T extends DocumentData>(
  path: string,
  ...constraints: QueryConstraint[]
): Promise<Stored<T>[]> {
  const snap = await getDocs(query(collection(db, path), ...constraints));
  return snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Stored<T>);
}

/**
 * Like `list`, but reads only the copy kept on this device: instant, and works
 * offline. Empty when nothing has been cached yet.
 */
export async function listFromCache<T extends DocumentData>(
  path: string,
): Promise<Stored<T>[]> {
  try {
    const snap = await getDocsFromCache(collection(db, path));
    return snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Stored<T>);
  } catch {
    return [];
  }
}

/** A fresh document id, so a document can be shown before the server has confirmed it. */
export const newId = (path: string) => doc(collection(db, path)).id;

/** Update fields on an existing document. Fails if the document doesn't exist. */
export async function update<T extends DocumentData>(
  path: string,
  id: string,
  patch: Partial<T>,
): Promise<void> {
  await updateDoc(doc(db, path, id), { ...patch, updatedAt: serverTimestamp() });
}

/** Create-or-merge: writes the fields, creating the document if needed. */
export async function upsert<T extends DocumentData>(
  path: string,
  id: string,
  data: Partial<T>,
): Promise<void> {
  await setDoc(
    doc(db, path, id),
    { ...data, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

/** Deletes individual fields from a document, leaving the rest in place. */
export async function clearFields(
  path: string,
  id: string,
  fields: string[],
): Promise<void> {
  const cleared = Object.fromEntries(fields.map((f) => [f, deleteField()]));
  await setDoc(
    doc(db, path, id),
    { ...cleared, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function remove(path: string, id: string): Promise<void> {
  await deleteDoc(doc(db, path, id));
}

/** Live updates for a collection. Returns an unsubscribe function. */
export function watch<T extends DocumentData>(
  path: string,
  onChange: (docs: Stored<T>[]) => void,
  onError?: (error: Error) => void,
  ...constraints: QueryConstraint[]
): Unsubscribe {
  return onSnapshot(
    query(collection(db, path), ...constraints),
    (snap) =>
      onChange(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Stored<T>)),
    onError,
  );
}

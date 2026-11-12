import * as crud from "./crud";

/** Everything a user owns lives under users/{uid}. */
export const USERS = "users";

export interface UserProfile {
  displayName: string;
  email: string;
}

export const createUserProfile = (uid: string, profile: UserProfile) =>
  crud.create<UserProfile>(USERS, profile, uid);

export const getUserProfile = (uid: string) =>
  crud.get<UserProfile>(USERS, uid);

export const updateUserProfile = (uid: string, patch: Partial<UserProfile>) =>
  crud.update<UserProfile>(USERS, uid, patch);

/** Creates the profile on first sign-in and leaves an existing one untouched. */
export async function ensureUserProfile(uid: string, profile: UserProfile) {
  const existing = await getUserProfile(uid);
  if (!existing) await createUserProfile(uid, profile);
}

export const deleteUserProfile = (uid: string) => crud.remove(USERS, uid);

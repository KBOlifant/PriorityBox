import type { NextFunction, Request, Response } from "express";

/** Confirms a Firebase ID token is valid, so only signed-in users can spend the Groq key. */
async function isSignedIn(idToken: string): Promise<boolean> {
  const key = process.env.FIREBASE_API_KEY;
  if (!key || !idToken) return false;
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
  if (await isSignedIn(token)) return next();
  res.status(401).json({ error: "Please sign in again." });
}

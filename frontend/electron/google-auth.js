// Google OAuth for installed apps: system browser + loopback redirect + PKCE.
const { shell } = require("electron");
const http = require("http");
const crypto = require("crypto");

const b64url = (buf) => buf.toString("base64url");

async function googleAuth({ clientId, clientSecret, scope, prompt, loginHint }) {
  if (!clientId) throw new Error("not_configured");

  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());
  const state = b64url(crypto.randomBytes(16));

  const { code, redirectUri } = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, "http://127.0.0.1");
      if (url.pathname !== "/") {
        res.writeHead(404).end();
        return;
      }
      const err = url.searchParams.get("error");
      const gotCode = url.searchParams.get("code");
      const ok = !err && gotCode && url.searchParams.get("state") === state;
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(
        `<!doctype html><title>PriorityBox</title><body style="font-family:sans-serif;text-align:center;margin-top:20vh">` +
          (ok ? "Gmail connected. You can close this tab and return to PriorityBox." : "Sign-in failed. You can close this tab.") +
          "</body>",
      );
      clearTimeout(timer);
      server.close();
      if (ok) resolve({ code: gotCode, redirectUri: `http://127.0.0.1:${server.address().port}` });
      else reject(new Error(err === "access_denied" ? "access_denied" : "failed"));
    });
    const timer = setTimeout(() => {
      server.close();
      reject(new Error("timeout"));
    }, 5 * 60 * 1000);
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const redirect = `http://127.0.0.1:${server.address().port}`;
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirect,
        response_type: "code",
        scope,
        state,
        code_challenge: challenge,
        code_challenge_method: "S256",
        prompt: prompt || "select_account",
      });
      if (loginHint) params.set("login_hint", loginHint);
      shell.openExternal(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
    });
  });

  const body = new URLSearchParams({
    client_id: clientId,
    code,
    code_verifier: verifier,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });
  if (clientSecret) body.set("client_secret", clientSecret);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) throw new Error(json.error || "failed");
  return { access_token: json.access_token, expires_in: json.expires_in };
}

module.exports = { googleAuth };

import cors from "cors";
import express from "express";
import { AiError, generate, isValidRequest } from "./ai.js";
import { requireAuth } from "./auth.js";

const app = express();
const port = Number(process.env.PORT) || 4000;
const origins = (process.env.ALLOWED_ORIGINS ?? "http://localhost:3000")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({ origin: origins }));
app.use(express.json({ limit: "50kb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/ai", requireAuth, async (req, res) => {
  if (!isValidRequest(req.body)) {
    return res.status(400).json({ error: "Invalid request." });
  }
  try {
    res.json({ text: await generate(req.body) });
  } catch (err) {
    if (err instanceof AiError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});

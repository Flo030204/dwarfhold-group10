import cors from "cors";
import express from "express";
import { randomTool } from "./toolReward.js";

const app = express();
const port = Number(process.env.PORT ?? 4200);
let expeditionNumber = 16;

const outcomes = {
  "crystal-cave": { rewards: { stone: 8 }, message: "The scout found a crystal seam and an abandoned tool." },
  "old-mine": { rewards: { stone: 12, wood: 2 }, message: "The old mine still holds good stone and usable supports." },
  "spider-cave": { rewards: { food: 50, stone: 20, wood: 15 }, message: "The scout found a hidden cache in the Spider Cave." }, // Die erfolgreiche Reise liefert die Beute fuer die anschliessende Verteidigung.
};

app.use(cors()); app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "dwarfhold" }));

app.post("/api/expeditions", (req, res) => {
  // simulated latency
  const latency = Math.max(0, Math.min(5000, Number(req.query.latency ?? process.env.API_LATENCY ?? 2000)));

  setTimeout(() => {
    const { dwarfId, destination } = req.body ?? {};

    if (typeof dwarfId !== "string" || typeof destination !== "string") {
      return res.status(400).json({ error: "dwarfId and destination are required" });
    }
    if (req.query.fail === "true" || destination === "blocked-pass") {
      return res.status(503).json({ error: "Rockfall has sealed the route. The company heard no signal." });
    }
    
    const outcome = outcomes[destination];
    
    if (!outcome) return res.status(404).json({ error: "That destination is not on the hold map" });
    
    expeditionNumber += 1;
    
    const toolReward = destination === "crystal-cave" ? randomTool() : undefined; // Jeder Erfolg lost genau eine Werkzeugart aus.
    res.json({ expeditionId: `exp-${expeditionNumber}`, status: "completed", ...outcome, ...(toolReward ? { toolReward } : {}) });
  }, latency);
});

app.listen(port, () => console.log(`Dwarfhold API listening on http://localhost:${port}`));

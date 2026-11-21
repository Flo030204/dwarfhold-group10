import { toolTypes } from "./equipment";
import type { ExpeditionResult, ResourceKey, Resources, ToolType } from "./types";

const resourceKeys: ResourceKey[] = ["wood", "stone", "food", "weapons"]; // Die Antwort darf keine alten oder unbekannten Lagerfelder einfuehren.
const expeditionTimeoutMs = 10_000; // Eine haengende Anfrage gibt den Scout nach zehn Sekunden wieder frei.

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value); // JSON-Objekte muessen vor dem Zugriff zur Laufzeit geprueft werden.
}

export function parseExpeditionResult(value: unknown): ExpeditionResult {
  if (!isRecord(value) || value.status !== "completed" || typeof value.expeditionId !== "string" || !value.expeditionId || typeof value.message !== "string" || !isRecord(value.rewards)) {
    throw new Error("The expedition returned an invalid response."); // Ein TypeScript-Cast allein wuerde diese Felder nicht pruefen.
  }

  const rewards: Partial<Resources> = {};
  for (const [key, amount] of Object.entries(value.rewards)) {
    if (!resourceKeys.includes(key as ResourceKey) || !Number.isSafeInteger(amount) || (amount as number) < 0) {
      throw new Error("The expedition returned an invalid reward."); // Unbekannte Schluessel und kaputte Mengen werden vor jeder Gutschrift abgewiesen.
    }
    rewards[key as ResourceKey] = amount as number;
  }

  if (value.toolReward !== undefined && !toolTypes.includes(value.toolReward as ToolType)) {
    throw new Error("The expedition returned an unknown tool."); // Nur Axt, Spitzhacke oder Pilzsichel duerfen ins Lager gelangen.
  }

  return {
    expeditionId: value.expeditionId,
    status: "completed",
    rewards,
    message: value.message,
    toolReward: value.toolReward as ToolType | undefined,
  };
}

export async function beginExpedition(dwarfId: string, destination: string): Promise<ExpeditionResult> {
  const controller = new AbortController(); // Das Signal kann einen haengenden HTTP-Aufruf abbrechen.
  const timeout = globalThis.setTimeout(() => controller.abort(), expeditionTimeoutMs);

  try {
    const response = await fetch("/api/expeditions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dwarfId, destination }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null); // Auch eine unlesbare Fehlerantwort soll den Scout freigeben.
      const message = isRecord(body) && typeof body.error === "string" ? body.error : `Expedition failed (${response.status})`;
      throw new Error(message);
    }
    return parseExpeditionResult(await response.json()); // Erst eine gepruefte Antwort darf Beute ausloesen.
  } catch (error) {
    if (controller.signal.aborted) throw new Error("The expedition timed out after 10 seconds."); // Der Fehlerpfad setzt den Zwerg danach wieder frei.
    throw error;
  } finally {
    globalThis.clearTimeout(timeout); // Kein Timeout bleibt nach Erfolg oder Fehlschlag aktiv.
  }
}

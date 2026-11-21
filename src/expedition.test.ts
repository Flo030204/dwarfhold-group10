import { describe, expect, it, vi } from "vitest";
import { beginExpedition, parseExpeditionResult } from "./api";
import { craftItem, equipTool } from "./equipment";
import { finishExpeditionFailure, finishExpeditionSuccess, startExpedition } from "./expedition";
import type { ColonyState, ExpeditionResult } from "./types";

function makeState(): ColonyState {
  return {
    day: 12,
    resources: { wood: 10, stone: 5, food: 9, weapons: 0 },
    toolStock: { axe: 0, pickaxe: 0, mushroomSickle: 0 },
    dwarves: [
      { id: "d1", name: "Yrsa", title: "", icon: "", assignment: "woodcutting", status: "working", equippedTool: "axe" },
      { id: "d2", name: "Dori", title: "", icon: "", assignment: null, status: "idle", equippedTool: null },
    ],
  }; // Der erste Scout traegt bewusst ein Werkzeug, damit die Lagerregel mitgeprueft wird.
}

const caveResult: ExpeditionResult = {
  expeditionId: "exp-17", status: "completed", rewards: { stone: 8 },
  toolReward: "pickaxe", message: "The scout returned.",
};

describe("expedition state transitions", () => {
  it("returns the tool before departure and leaves the scout unequipped afterward", () => {
    const departed = startExpedition(makeState(), "d1", "crystal-cave", "request-1");
    expect(departed.toolStock.axe).toBe(1); // Die Axt liegt schon waehrend der Reise frei im Lager.
    expect(departed.dwarves[0]).toMatchObject({ status: "expedition", equippedTool: null });
    const returned = finishExpeditionSuccess(departed, "request-1", caveResult);
    expect(returned.dwarves[0]).toMatchObject({ status: "working", equippedTool: null }); // Die Axt wird nicht automatisch erneut ausgeruestet.
    expect(returned.toolStock).toMatchObject({ axe: 1, pickaxe: 1 });
    expect(returned.resources.stone).toBe(13);
  });

  it("does not reclaim a deposited tool that another dwarf equipped during the trip", () => {
    const departed = startExpedition(makeState(), "d1", "crystal-cave", "request-1");
    const shared = equipTool(departed, "d2", "axe"); // Die abgelegte Axt ist sofort fuer andere Bewohner verfuegbar.
    const returned = finishExpeditionSuccess(shared, "request-1", caveResult);
    expect(returned.dwarves[0].equippedTool).toBeNull();
    expect(returned.dwarves[1].equippedTool).toBe("axe"); // Die Rueckkehr nimmt Dori sein Werkzeug nicht weg.
    expect(returned.toolStock.axe).toBe(0);
  });

  it("rejects a second start and awards the accepted result only once", () => {
    const departed = startExpedition(makeState(), "d1", "crystal-cave", "request-1");
    expect(startExpedition(departed, "d2", "old-mine", "request-2")).toBe(departed); // Auch ein anderer Zwerg kann nicht parallel aufbrechen.
    expect(craftItem(departed, "d1", "axe")).toBe(departed); // Der Scout kann nicht gleichzeitig schmieden.
    const returned = finishExpeditionSuccess(departed, "request-1", caveResult);
    expect(finishExpeditionSuccess(returned, "request-1", caveResult)).toBe(returned); // Eine zweite Antwort hat keinen aktiven Auftrag mehr.
    expect(returned.resources.stone).toBe(13);
    expect(returned.toolStock.pickaxe).toBe(1);
  });

  it("returns the scout after failure without undoing the tool deposit or granting rewards", () => {
    const departed = startExpedition(makeState(), "d1", "blocked-pass", "request-1");
    const failed = finishExpeditionFailure(departed, "request-1", "Rockfall blocked the pass.");
    expect(failed.dwarves[0]).toMatchObject({ status: "working", equippedTool: null });
    expect(failed.toolStock.axe).toBe(1); // Die vor dem Aufbruch abgelegte Axt bleibt im Lager.
    expect(failed.resources).toEqual(departed.resources); // Ein Fehlschlag vergibt keine Rohstoffe.
    expect(failed.activeExpedition).toBeUndefined();
  });

  it("ignores an old response after a new expedition has begun", () => {
    const first = startExpedition(makeState(), "d1", "crystal-cave", "request-1");
    const returned = finishExpeditionFailure(first, "request-1", "Timeout");
    const second = startExpedition(returned, "d2", "old-mine", "request-2");
    expect(finishExpeditionSuccess(second, "request-1", caveResult)).toBe(second); // Die alte Antwort darf den zweiten Scout nicht freigeben.
    expect(finishExpeditionFailure(second, "request-1", "Late failure")).toBe(second);
    expect(second.dwarves[1].status).toBe("expedition");
  });

  it("ignores rewards after game over and refuses a crafting dwarf", () => {
    const crafting = craftItem(makeState(), "d1", "axe");
    expect(startExpedition(crafting, "d1", "crystal-cave", "request-1")).toBe(crafting);
    const departed = startExpedition(makeState(), "d1", "crystal-cave", "request-1");
    const gameOver = { ...departed, foodShortage: { daysRemaining: 0, acknowledged: true } };
    const returned = finishExpeditionSuccess(gameOver, "request-1", caveResult);
    expect(returned.resources.stone).toBe(5); // Ein spaeter Erfolg veraendert einen beendeten Spielstand nicht.
    expect(returned.toolStock.pickaxe).toBe(0);
    expect(returned.activeExpedition).toBeUndefined();
  });
});

describe("expedition API validation", () => {
  it("accepts the current contract and rejects old or malformed rewards", () => {
    expect(parseExpeditionResult(caveResult)).toEqual(caveResult);
    expect(() => parseExpeditionResult({ ...caveResult, rewards: { tools: 1 } })).toThrow("invalid reward"); // Der alte API-Schluessel darf die Ressourcenleiste nicht mehr zerstoeren.
    expect(() => parseExpeditionResult({ ...caveResult, rewards: { stone: -8 } })).toThrow("invalid reward");
    expect(() => parseExpeditionResult({ ...caveResult, toolReward: "hammer" })).toThrow("unknown tool");
  });

  it("aborts a request that does not answer within ten seconds", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", (_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
      options.signal?.addEventListener("abort", () => reject(new Error("Aborted"))); // Simuliert einen haengenden Aufruf bis zum Abbruchsignal.
    }));
    try {
      const pending = beginExpedition("d1", "crystal-cave");
      const assertion = expect(pending).rejects.toThrow("timed out");
      await vi.advanceTimersByTimeAsync(10_000);
      await assertion;
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers(); // Andere Tests bekommen wieder echte Zeit und echtes fetch.
    }
  });
});

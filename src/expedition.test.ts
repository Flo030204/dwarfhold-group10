import { describe, expect, it, vi } from "vitest";
import { beginExpedition, parseExpeditionResult } from "./api";
import { craftItem, equipTool } from "./equipment";
import { acknowledgeRaid, finishExpeditionFailure, finishExpeditionSuccess, startExpedition } from "./expedition"; // Prueft die Bestaetigung beider Angriffsmeldungen.
import { advanceDay } from "./simulation"; // Prueft, dass die Tagesuhr waehrend beider Popups steht.
import type { ColonyState, ExpeditionResult } from "./types";

function makeState(): ColonyState {
  return {
    day: 12,
    resources: { wood: 10, stone: 5, food: 9, weapons: 0 },
    toolStock: { axe: 0, pickaxe: 0, mushroomSickle: 0 },
    residents: [
      { id: "d1", species: "dwarf", name: "Yrsa", title: "", icon: "", assignment: "woodcutting", status: "working", equippedTool: "axe" },
      { id: "d2", species: "dwarf", name: "Dori", title: "", icon: "", assignment: null, status: "idle", equippedTool: null },
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
    expect(departed.residents[0]).toMatchObject({ status: "expedition", equippedTool: null });
    const returned = finishExpeditionSuccess(departed, "request-1", caveResult);
    expect(returned.residents[0]).toMatchObject({ status: "working", equippedTool: null }); // Die Axt wird nicht automatisch erneut ausgeruestet.
    expect(returned.toolStock).toMatchObject({ axe: 1, pickaxe: 1 });
    expect(returned.resources.stone).toBe(13);
    expect(returned.residents.at(-1)).toMatchObject({ id: "elf-liora", species: "elf", assignment: "farming" }); // Der erste erfolgreiche Hoehlengang bringt Liora mit.
  });

  it("adds the elf only after the first successful Crystal Cave trip", () => {
    const failed = finishExpeditionFailure(startExpedition(makeState(), "d2", "crystal-cave", "failed"), "failed", "Blocked");
    expect(failed.residents).toHaveLength(2); // Ein Fehlschlag schaltet keinen neuen Bewohner frei.
    const mine = finishExpeditionSuccess(startExpedition(failed, "d2", "old-mine", "mine"), "mine", caveResult);
    expect(mine.residents).toHaveLength(2); // Ein anderer Zielort zaehlt auch bei Erfolg nicht.
    const first = finishExpeditionSuccess(startExpedition(mine, "d2", "crystal-cave", "cave"), "cave", caveResult);
    const second = finishExpeditionSuccess(startExpedition(first, "d2", "crystal-cave", "again"), "again", caveResult);
    expect(second.residents.filter((resident) => resident.species === "elf")).toHaveLength(1); // Weitere Hoehlenerfolge duplizieren Liora nicht.
  });

  it("does not reclaim a deposited tool that another dwarf equipped during the trip", () => {
    const departed = startExpedition(makeState(), "d1", "crystal-cave", "request-1");
    const shared = equipTool(departed, "d2", "axe"); // Die abgelegte Axt ist sofort fuer andere Bewohner verfuegbar.
    const returned = finishExpeditionSuccess(shared, "request-1", caveResult);
    expect(returned.residents[0].equippedTool).toBeNull();
    expect(returned.residents[1].equippedTool).toBe("axe"); // Die Rueckkehr nimmt Dori sein Werkzeug nicht weg.
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
    expect(failed.residents[0]).toMatchObject({ status: "working", equippedTool: null });
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
    expect(second.residents[1].status).toBe("expedition");
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

describe("Spider Cave defense", () => { // Prueft die Auswirkungen einer Rueckkehr aus der Spinnenhoehle.
  const result: ExpeditionResult = { ...caveResult, rewards: { food: 50, stone: 20, wood: 15 }, toolReward: undefined }; // Verwendet die vereinbarte Beute der Spinnenhoehle.
  it.each([12, 15])("spends exactly 12 weapons and keeps loot with %i weapons", (weapons) => { // Testet die Abwehrgrenze und den Waffenueberschuss.
    const state = makeState(); // Beginnt mit bekannten Vorraeten.
    state.resources.weapons = weapons; // Legt die zu pruefende Menge Waffen ins Lager.
    const departed = startExpedition(state, "d1", "spider-cave", "spiders"); // Startet die Reise zur Spinnenhoehle.
    const returned = finishExpeditionSuccess(departed, "spiders", result); // Bringt den Scout mitsamt Spinnen zurueck.
    expect(returned.resources).toEqual({ food: 59, stone: 25, wood: 25, weapons: weapons - 12 }); // Gutschrift und Waffenverbrauch geschehen zusammen.
    expect(returned.lastExpeditionEvent?.message).toContain("defended Stonehome successfully using 12 weapons"); // Nennt die Abwehr in der Chronik.
    expect(finishExpeditionSuccess(returned, "spiders", result)).toBe(returned); // Derselbe Angriff wird nur einmal abgerechnet.
  }); // Schliesst die Pruefung erfolgreicher Abwehr ab.

  it("spends all 11 weapons, loses the loot and raids existing stock", () => { // Prueft die Regel direkt unter der Abwehrgrenze.
    const state = makeState(); // Beginnt mit genuegend Lagerbestand fuer die vollen Verluste.
    state.resources = { food: 35, stone: 25, wood: 20, weapons: 11 }; // Legt die Vorraete und zu wenige Waffen fest.
    const departed = startExpedition(state, "d1", "spider-cave", "spiders"); // Schickt den Scout zur Spinnenhoehle.
    const returned = finishExpeditionSuccess(departed, "spiders", result); // Rechnet den verlorenen Angriff ab.
    expect(returned.resources).toEqual({ food: 15, stone: 10, wood: 5, weapons: 0 }); // Verbraucht alle Waffen und verliert Beute sowie Teile des bisherigen Lagers.
    expect(returned.lastExpeditionEvent?.message).toContain("Weapons spent: 11"); // Meldet die Zahl der verlorenen Waffen.
    expect(returned.lastExpeditionEvent).toMatchObject({ tone: "warning", message: expect.stringContaining("stole 20 rations, 15 stone and 15 timber") }); // Nennt den tatsaechlichen Vorratsverlust.
  }); // Schliesst die Pruefung eines verlorenen Angriffs ab.

  it("caps losses at zero and starts the food warning", () => { // Prueft eine Kolonie mit kleinen Vorraeten.
    const departed = startExpedition(makeState(), "d1", "spider-cave", "spiders"); // Startet ohne die zur Abwehr erforderlichen Waffen.
    const returned = finishExpeditionSuccess(departed, "spiders", result); // Laesst die Spinnen den knappen Vorrat pluendern.
    expect(returned.resources).toEqual({ food: 0, stone: 0, wood: 0, weapons: 0 }); // Kein Bestand wird negativ.
    expect(returned.foodShortage).toEqual({ daysRemaining: 3, acknowledged: false }); // Dieselbe Hungerwarnung erscheint wie beim Tageswechsel.
  }); // Schliesst die Pruefung der Mindestvorraete ab.

  it("shows the warning before the result and pauses until both are acknowledged", () => { // Prueft die Reihenfolge und Dauer der Pause.
    const state = makeState(); // Startet mit einer Kolonie, die den Angriff abwehren kann.
    state.resources.weapons = 12; // Legt genug Waffen fuer die Verteidigung bereit.
    const departed = startExpedition(state, "d1", "spider-cave", "spiders"); // Startet die gefaehrliche Reise.
    const warning = finishExpeditionSuccess(departed, "spiders", result); // Oeffnet die erste Meldung nach erfolgreicher Rueckkehr.
    expect(warning.raidPopup).toBe("attack"); // Die Warnung erscheint zuerst.
    expect(advanceDay(warning)).toBe(warning); // Die Tagesuhr steht waehrend der Warnung.
    const report = acknowledgeRaid(warning); // Der erste Klick oeffnet das Ergebnis.
    expect(report.raidPopup).toBe("result"); // Der Ausgang wird erst jetzt angezeigt.
    expect(advanceDay(report)).toBe(report); // Auch beim Ergebnis steht die Tagesuhr.
    const resumed = acknowledgeRaid(report); // Der zweite Klick schliesst das Popup.
    expect(resumed.resources).toEqual(warning.resources); // Die Bestaetigungen rechnen den Angriff nicht erneut ab.
    expect(advanceDay(resumed).day).toBe(state.day + 1); // Danach kann wieder ein Spieltag vergehen.
  }); // Schliesst den Test zur Abfolge der Popups ab.

  it("does not attack after a failed expedition", () => { // Prueft den Fehlerpfad des bedrohlichen Reiseziels.
    const departed = startExpedition(makeState(), "d1", "spider-cave", "spiders"); // Simuliert die Reise vor einem API-Fehler.
    const returned = finishExpeditionFailure(departed, "spiders", "The path collapsed."); // Holt den Scout ohne erfolgreichen Fund zurueck.
    expect(returned.resources).toEqual(departed.resources); // Weder Beute noch Pluenderung veraendern das Lager.
    expect(returned.raidPopup).toBeUndefined(); // Eine fehlgeschlagene Reise oeffnet kein Angriffspopup.
    expect(returned.lastExpeditionEvent?.message).toBe("The path collapsed."); // Zeigt den Reisefehler statt eines Angriffs an.
  }); // Schliesst die Pruefung fehlgeschlagener Reisen ab.
}); // Schliesst die Tests zur Spinnenhoehle ab.

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

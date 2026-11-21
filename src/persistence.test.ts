import { describe, expect, it } from "vitest"; // Verwendet den Testlaeufer des Projekts.
import { craftItem } from "./equipment"; // Erstellt einen echten Schmiedeauftrag fuer den Test.
import { finishExpeditionSuccess, startExpedition } from "./expedition"; // Prueft die Rueckkehr und spaete Beute nach dem Laden.
import { decodeSave, encodeSave, type ColonySave } from "./persistence"; // Prueft den gleichen Speicherweg wie der Browser.
import { advanceDay } from "./simulation"; // Laesst einen wiederhergestellten Auftrag regulaer fertig werden.

function newSave(): ColonySave { // Erstellt pro Test eine unabhaengige Kolonie.
  return { // Legt einen kleinen gueltigen Spielstand an.
    paused: true, // Simuliert eine manuell pausierte Sitzung.
    activities: [{ id: "welcome", day: 12, message: "Stonehome wakes." }], // Gibt der Chronik einen gespeicherten Eintrag.
    colony: { // Legt den aktuellen Tagesstand mit einem ausgeruesteten Zwerg fest.
      day: 12, // Beginnt am normalen Starttag.
      resources: { wood: 10, stone: 10, food: 0, weapons: 0 }, // Laesst genug Material fuer den Schmiedeauftrag uebrig.
      foodShortage: { daysRemaining: 2, acknowledged: true }, // Simuliert eine bereits bestaetigte Hungerfrist.
      toolStock: { axe: 0, pickaxe: 0, mushroomSickle: 0 }, // Das einzige Werkzeug ist bereits ausgeruestet.
      dwarves: [{ id: "d1", name: "Brom", title: "", icon: "", assignment: "mining", status: "working", equippedTool: "pickaxe" }], // Verbindet Aufgabe und Ausruestung.
    }, // Schliesst die Kolonie ab.
  }; // Gibt den gueltigen Spielstand zurueck.
} // Schliesst die Testdaten ab.

describe("colony save and restore", () => { // Gruppiert die Wiederherstellungstests.
  it("restores the saved colony and completes a forge order without paying twice", () => { // Prueft die Schmiede nach einem Reload.
    const save = newSave(); // Startet mit Hungerfrist, Pause und Chronik.
    save.colony = craftItem(save.colony, "d1", "axe"); // Zieht Zutaten ab und startet den Auftrag.
    const restored = decodeSave(encodeSave(save)); // Simuliert Speichern und anschliessendes Neuladen.
    expect(restored).toEqual(save); // Vergleicht alle gespeicherten Felder mit dem Stand vor dem Reload.
    if (!restored) throw new Error("Expected a restored colony"); // Verlangt einen gueltigen Spielstand fuer den Tageswechsel.
    const nextDay = advanceDay(restored.colony); // Schliesst den Auftrag regulaer ab.
    expect(nextDay.resources).toMatchObject({ wood: 7, stone: 8 }); // Die Zutaten werden beim Abschluss nicht erneut abgezogen.
    expect(nextDay.toolStock.axe).toBe(1); // Die fertige Axt liegt genau einmal im Lager.
    expect(nextDay.dwarves[0].status).toBe("working"); // Der Schmied nimmt seine alte Arbeit wieder auf.
  }); // Schliesst den Test zum Schmiedeauftrag ab.

  it("cancels travel on reload and ignores a late expedition reward", () => { // Prueft den gewaehlten Umgang mit unterbrochenen Reisen.
    const save = newSave(); // Beginnt mit einem ausgeruesteten Bergarbeiter.
    save.colony = startExpedition(save.colony, "d1", "old-mine", "trip"); // Legt das Werkzeug ab und startet die Reise.
    const restored = decodeSave(encodeSave(save)); // Stellt den Stand waehrend der Reise wieder her.
    if (!restored) throw new Error("Expected a restored colony"); // Verlangt einen gueltigen Spielstand fuer die weiteren Pruefungen.
    expect(restored.colony.activeExpedition).toBeUndefined(); // Startet nach Reload keine Anfrage fuer diese Reise.
    expect(restored.colony.resources).toEqual(save.colony.resources); // Laesst den Materialbestand unveraendert.
    expect(restored.colony.toolStock.pickaxe).toBe(1); // Die beim Aufbruch abgelegte Spitzhacke bleibt einmal im Lager.
    expect(restored.colony.dwarves[0]).toMatchObject({ assignment: "mining", status: "working", equippedTool: null }); // Gibt den Scout fuer seine bisherige Arbeit frei.
    expect(restored.colony.lastExpeditionEvent?.message).toContain("canceled after reloading"); // Hinterlegt die Meldung fuer die Chronik.
    expect(finishExpeditionSuccess(restored.colony, "trip", { expeditionId: "trip", status: "completed", rewards: { stone: 4 }, message: "Found stone." })).toBe(restored.colony); // Ignoriert Beute aus dem stornierten Auftrag.
  }); // Schliesst den Test zur Expedition ab.

  it("rejects broken JSON, unknown versions and inconsistent worker state", () => { // Prueft Fehlerfaelle vor der Wiederherstellung.
    const save = newSave(); // Erstellt ansonsten gueltige Speicherdaten.
    expect(decodeSave("{")).toBeNull(); // Lehnt abgeschnittenes JSON ab.
    expect(decodeSave(JSON.stringify({ version: 999, ...save }))).toBeNull(); // Lehnt inkompatible Versionen ab.
    save.colony.dwarves[0].status = "crafting"; // Erzeugt absichtlich einen Schmied ohne Auftrag.
    expect(decodeSave(encodeSave(save))).toBeNull(); // Laesst ungueltige Zustandskombinationen nicht ins Spiel.
  }); // Schliesst die Fehlerpruefung ab.
}); // Schliesst die Tests zur Speicherung ab.

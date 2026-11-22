import { describe, expect, it } from "vitest"; // Verwendet den Testlaeufer des Projekts.
import { craftItem } from "./equipment"; // Erstellt einen echten Schmiedeauftrag fuer den Test.
import { completeDueExpedition, recordExpeditionSuccess, startExpedition } from "./expedition"; // Prueft gespeicherte Berichte und tagbasierte Rueckkehr.
import { decodeSave, encodeSave, type ColonySave } from "./persistence"; // Prueft den gleichen Speicherweg wie der Browser.
import { advanceDay } from "./simulation"; // Laesst einen wiederhergestellten Auftrag regulaer fertig werden.
import { elfResident } from "./residents"; // Verwendet dieselbe Elfenkennung wie das Spiel.

function newSave(): ColonySave { // Erstellt pro Test eine unabhaengige Kolonie.
  return { // Legt einen kleinen gueltigen Spielstand an.
    paused: true, // Simuliert eine manuell pausierte Sitzung.
    activities: [{ id: "welcome", day: 12, message: "Stonehome wakes." }], // Gibt der Chronik einen gespeicherten Eintrag.
    colony: { // Legt den aktuellen Tagesstand mit einem ausgeruesteten Zwerg fest.
      day: 12, // Beginnt am normalen Starttag.
      resources: { wood: 10, stone: 10, food: 0, weapons: 0 }, // Laesst genug Material fuer den Schmiedeauftrag uebrig.
      foodShortage: { daysRemaining: 2, acknowledged: true }, // Simuliert eine bereits bestaetigte Hungerfrist.
      toolStock: { axe: 0, pickaxe: 0, mushroomSickle: 0 }, // Das einzige Werkzeug ist bereits ausgeruestet.
      residents: [{ id: "d1", species: "dwarf", name: "Brom", title: "", icon: "", assignment: "mining", status: "working", equippedTool: "pickaxe" }], // Verbindet Aufgabe und Ausruestung.
    }, // Schliesst die Kolonie ab.
  }; // Gibt den gueltigen Spielstand zurueck.
} // Schliesst die Testdaten ab.

describe("colony save and restore", () => { // Gruppiert die Wiederherstellungstests.
  it("restores an elf's unfinished seven-day order", () => {
    const save = newSave();
    save.colony.resources.food = 100; // Verhindert, dass Hunger die Zeitpruefung unterbricht.
    save.colony.foodShortage = undefined;
    save.colony.residents.push({ ...elfResident });
    save.colony = advanceDay(advanceDay(craftItem(save.colony, elfResident.id, "weapon")));
    const restored = decodeSave(encodeSave(save));
    expect(restored?.colony.residents[1].forgeTask).toEqual({ item: "weapon", completesOnDay: 19 }); // Nach zwei Tagen bleiben noch fuenf.
    if (!restored) throw new Error("Expected the elf order to be restored");
    let current = restored.colony;
    for (let day = 0; day < 5; day += 1) current = advanceDay(current);
    expect(current.resources.weapons).toBe(1); // Der Auftrag wird nach Reload genau einmal geliefert.
    expect(current.residents[1].status).toBe("working");
  });

  it("migrates a version-one dwarf save without losing its colony", () => {
    const save = newSave();
    const { residents, ...rest } = save.colony;
    const oldSave = { version: 1, colony: { ...rest, dwarves: residents.map(({ species: _species, ...dwarf }) => dwarf) }, paused: save.paused, activities: save.activities }; // Baut das tatsaechliche alte Speicherformat nach.
    const restored = decodeSave(JSON.stringify(oldSave));
    expect(restored?.colony.residents[0]).toMatchObject({ id: "d1", species: "dwarf", equippedTool: "pickaxe" });
    expect(restored?.colony.resources).toEqual(save.colony.resources); // Vorraete und alte Werkzeuge bleiben erhalten.
  });

  it("resumes a travelling dwarf from a version-one save after migration", () => {
    const save = newSave();
    save.colony = startExpedition(save.colony, "d1", "old-mine", "legacy-trip");
    const { residents, activeExpedition, ...rest } = save.colony;
    const oldSave = { version: 1, colony: {
      ...rest,
      dwarves: residents.map(({ species: _species, ...dwarf }) => dwarf),
      activeExpedition: { requestId: activeExpedition?.requestId, dwarfId: activeExpedition?.residentId, destination: activeExpedition?.destination },
    }, paused: save.paused, activities: save.activities }; // Stellt die alten Feldnamen auch fuer einen offenen Reiseauftrag her.
    const restored = decodeSave(JSON.stringify(oldSave));
    expect(restored?.colony.activeExpedition).toMatchObject({ residentId: "d1", returnsOnDay: 13 }); // Der alten Reise fehlt nur der neue Rueckkehrtag.
    expect(restored?.colony.residents[0]).toMatchObject({ status: "expedition", equippedTool: null }); // Das Werkzeug bleibt abgelegt, waehrend die Reise fortgesetzt wird.
  });

  it("adds a return day to an unfinished version-two expedition", () => {
    const save = newSave();
    save.colony = startExpedition(save.colony, "d1", "old-mine", "version-two-trip");
    const { returnsOnDay: _returnsOnDay, ...oldTrip } = save.colony.activeExpedition!;
    const legacy = { version: 2, colony: { ...save.colony, activeExpedition: oldTrip }, paused: save.paused, activities: save.activities }; // Das alte Format kannte noch keinen Rueckkehrtag.
    const restored = decodeSave(JSON.stringify(legacy));
    expect(restored?.colony.activeExpedition).toMatchObject({ requestId: "version-two-trip", returnsOnDay: 13 }); // Die Reise wird fortgesetzt, ohne die Kolonie zu verlieren.
    expect(restored?.paused).toBe(true); // Auch der manuelle Pausenstatus bleibt bestehen.
  });
  it("restores the saved colony and completes a forge order without paying twice", () => { // Prueft die Schmiede nach einem Reload.
    const save = newSave(); // Startet mit Hungerfrist, Pause und Chronik.
    save.colony = craftItem(save.colony, "d1", "axe"); // Zieht Zutaten ab und startet den Auftrag.
    const restored = decodeSave(encodeSave(save)); // Simuliert Speichern und anschliessendes Neuladen.
    expect(restored).toEqual(save); // Vergleicht alle gespeicherten Felder mit dem Stand vor dem Reload.
    if (!restored) throw new Error("Expected a restored colony"); // Verlangt einen gueltigen Spielstand fuer den Tageswechsel.
    const nextDay = advanceDay(restored.colony); // Schliesst den Auftrag regulaer ab.
    expect(nextDay.resources).toMatchObject({ wood: 7, stone: 8 }); // Die Zutaten werden beim Abschluss nicht erneut abgezogen.
    expect(nextDay.toolStock.axe).toBe(1); // Die fertige Axt liegt genau einmal im Lager.
    expect(nextDay.residents[0].status).toBe("working"); // Der Schmied nimmt seine alte Arbeit wieder auf.
  }); // Schliesst den Test zum Schmiedeauftrag ab.

  it("keeps a received report through reload and returns the scout after one day", () => { // Prueft die Reise wie einen gespeicherten Schmiedeauftrag.
    const save = newSave(); // Beginnt mit einem ausgeruesteten Bergarbeiter.
    save.colony = startExpedition(save.colony, "d1", "old-mine", "trip"); // Legt das Werkzeug ab und startet die Reise.
    save.colony = recordExpeditionSuccess(save.colony, "trip", { expeditionId: "trip", status: "completed", rewards: { stone: 4 }, message: "Found stone." }); // Speichert eine frueh empfangene API-Antwort.
    const restored = decodeSave(encodeSave(save)); // Stellt den Stand waehrend der Reise wieder her.
    if (!restored) throw new Error("Expected a restored colony"); // Verlangt einen gueltigen Spielstand fuer die weiteren Pruefungen.
    expect(restored.colony.activeExpedition?.outcome?.kind).toBe("success"); // Der Bericht bleibt erhalten und muss nicht neu angefragt werden.
    expect(completeDueExpedition(restored.colony)).toBe(restored.colony); // Ohne Tageswechsel bleibt der Scout unterwegs und die Beute aus.
    expect(restored.colony.resources).toEqual(save.colony.resources); // Laesst den Materialbestand bis zur Rueckkehr unveraendert.
    expect(restored.colony.toolStock.pickaxe).toBe(1); // Die beim Aufbruch abgelegte Spitzhacke bleibt einmal im Lager.
    expect(restored.colony.residents[0].status).toBe("expedition"); // Der Scout bleibt bis zum Rueckkehrtag belegt.
    const returned = completeDueExpedition(advanceDay(restored.colony)); // Simuliert Fortsetzen und genau einen Spieltag.
    expect(returned.activeExpedition).toBeUndefined();
    expect(returned.residents[0]).toMatchObject({ assignment: "mining", status: "working", equippedTool: null });
    expect(returned.resources.stone).toBe(14); // Die gespeicherte Beute wird genau einmal ausgezahlt.
    expect(completeDueExpedition(returned)).toBe(returned); // Ein zweiter Effekt kann die Beute nicht duplizieren.
  }); // Schliesst den Test zur Expedition ab.

  it("rejects broken JSON, unknown versions and inconsistent worker state", () => { // Prueft Fehlerfaelle vor der Wiederherstellung.
    const save = newSave(); // Erstellt ansonsten gueltige Speicherdaten.
    expect(decodeSave("{")).toBeNull(); // Lehnt abgeschnittenes JSON ab.
    expect(decodeSave(JSON.stringify({ version: 999, ...save }))).toBeNull(); // Lehnt inkompatible Versionen ab.
    save.colony.residents[0].status = "crafting"; // Erzeugt absichtlich einen Schmied ohne Auftrag.
    expect(decodeSave(encodeSave(save))).toBeNull(); // Laesst ungueltige Zustandskombinationen nicht ins Spiel.
  }); // Schliesst die Fehlerpruefung ab.
}); // Schliesst die Tests zur Speicherung ab.

import { describe, expect, it } from "vitest";
import { craftItem, equipTool, returnTool } from "./equipment";
import { advanceDay, dailyResourceChange } from "./simulation";
import { elfResident } from "./residents"; // Testet die echten Stammdaten der Elfe.
import type { ColonyState, JobType, ResourceKey, ToolType } from "./types";

function makeState(): ColonyState {
  return {
    day: 1,
    resources: { wood: 10, stone: 10, food: 5, weapons: 0 },
    toolStock: { axe: 1, pickaxe: 1, mushroomSickle: 1 },
    residents: [{ id: "d1", species: "dwarf", name: "Brom", title: "", icon: "", assignment: "woodcutting", status: "working", equippedTool: null }],
  }; // Jeder Test beginnt mit demselben unabhaengigen Spielstand.
}

describe("colony simulation", () => {
  it("gives the elf zero wood and stone, double food, and one sickle bonus", () => {
    const state = makeState();
    state.residents.push({ ...elfResident, assignment: "woodcutting", equippedTool: "axe" }); // Auch ein manipulierter Spielstand darf keinen Holzertrag erzeugen.
    expect(dailyResourceChange(state)).toMatchObject({ wood: 3, stone: 0, food: -2 });
    state.residents[1] = { ...elfResident, assignment: "mining", equippedTool: "pickaxe" };
    expect(dailyResourceChange(state).stone).toBe(0); // Die Spitzhacke umgeht die Sperre nicht.
    state.residents[1] = { ...elfResident };
    expect(dailyResourceChange(state).food).toBe(6); // Acht erzeugte Rationen minus zwei Mahlzeiten.
    state.residents[1].equippedTool = "mushroomSickle";
    expect(dailyResourceChange(state).food).toBe(7); // Die passende Sichel erhoeht acht auf neun.
  });
  it("produces assigned resources and feeds the company", () => {
    const state = makeState();
    expect(advanceDay(state)).toMatchObject({ day: 2, resources: { wood: 13, food: 4 } });
    expect(state.resources.wood).toBe(10); // Der vorherige Zustand bleibt unveraendert.
  });

  const matchingCases: [JobType, ToolType, ResourceKey, number][] = [
    ["woodcutting", "axe", "wood", 4],
    ["mining", "pickaxe", "stone", 3],
    ["farming", "mushroomSickle", "food", 4], // Die Tagesbilanz enthaelt bereits eine verbrauchte Ration.
  ];

  it.each(matchingCases)("gives the matching %s tool exactly one extra %s", (job, tool, resource, expected) => {
    const state = makeState();
    state.residents[0].assignment = job;
    state.residents[0].equippedTool = tool;
    expect(dailyResourceChange(state)[resource]).toBe(expected);
  });

  it("does not give a bonus for the wrong job or for travel", () => {
    const state = makeState();
    state.residents[0].equippedTool = "pickaxe";
    expect(dailyResourceChange(state).wood).toBe(3); // Die Spitzhacke hilft nicht beim Holzfaellen.
    state.residents[0].status = "expedition";
    expect(dailyResourceChange(state).wood).toBe(0); // Reisende produzieren auch mit Werkzeug nichts.
  });
});

describe("equipment and recipes", () => {
  it.each(["axe", "pickaxe", "mushroomSickle", "weapon"] as const)("lets the elf forge %s in seven days", (item) => {
    const state = makeState();
    state.resources.food = 100; // Die sieben Tage sollen nicht durch Hunger unterbrochen werden.
    state.residents.push({ ...elfResident });
    const started = craftItem(state, elfResident.id, item);
    expect(started.residents[1].forgeTask).toEqual({ item, completesOnDay: 8 });
    expect(craftItem(started, elfResident.id, item)).toBe(started); // Ein zweiter Auftrag ist waehrend des Schmiedens gesperrt.
    let current = started;
    for (let day = 2; day <= 7; day += 1) {
      current = advanceDay(current);
      expect(current.residents[1].status).toBe("crafting"); // Vor Tag acht ist kein Rezept fertig.
    }
    current = advanceDay(current);
    expect(current.residents[1]).toMatchObject({ status: "working", assignment: "farming" });
    expect(current.residents[1].forgeTask).toBeUndefined(); // Nach genau sieben Tageswechseln ist der Auftrag beendet.
    if (item === "weapon") expect(current.resources.weapons).toBe(1);
    else expect(current.toolStock[item]).toBe(state.toolStock[item] + 1);
  });
  it("moves one tool between the free stock and one dwarf", () => {
    const state = makeState();
    const equipped = equipTool(state, "d1", "axe");
    expect(equipped.toolStock.axe).toBe(0);
    expect(equipped.residents[0].equippedTool).toBe("axe");
    expect(equipTool(equipped, "d1", "axe")).toBe(equipped); // Dasselbe Werkzeug kann nicht doppelt ausgegeben werden.
    const returned = returnTool(equipped, "d1");
    expect(returned.toolStock.axe).toBe(1);
    expect(returned.residents[0].equippedTool).toBeNull();
  });

  it("swaps tools without changing their combined number", () => {
    const withAxe = equipTool(makeState(), "d1", "axe");
    const withPickaxe = equipTool(withAxe, "d1", "pickaxe");
    expect(withPickaxe.toolStock).toMatchObject({ axe: 1, pickaxe: 0 });
    expect(withPickaxe.residents[0].equippedTool).toBe("pickaxe");
  });

  it("rejects equipment changes while the dwarf is away", () => {
    const state = makeState();
    state.residents[0].status = "expedition";
    expect(equipTool(state, "d1", "axe")).toBe(state);
  });

  it("delivers a tool or weapon at the next day change", () => { // Prueft Materialabzug, Wartezeit und Rueckkehr zur Arbeit fuer beide Rezepte.
    const started = craftItem(makeState(), "d1", "axe"); // Der Holzfaeller startet einen Auftrag.
    expect(started.resources).toMatchObject({ wood: 7, stone: 8, weapons: 0 }); // Die Zutaten werden beim Start abgezogen.
    expect(started.toolStock.axe).toBe(1); // Das fertige Werkzeug liegt noch nicht im Lager.
    expect(started.residents[0]).toMatchObject({ status: "crafting", forgeTask: { item: "axe", completesOnDay: 2 } }); // Der Zwerg ist bis Tag 2 belegt.
    const finished = advanceDay(started); // Stellt das Werkzeug am Tageswechsel fertig.
    expect(finished.resources).toMatchObject({ wood: 7, food: 4 }); // Beim Schmieden gibt es keinen Holzertrag, aber der Zwerg isst.
    expect(finished.toolStock.axe).toBe(2); // Das fertiggestellte Werkzeug geht ins freie Lager.
    expect(finished.residents[0]).toMatchObject({ status: "working", assignment: "woodcutting" }); // Der Zwerg nimmt seinen vorherigen Job wieder auf.
    expect(finished.residents[0].forgeTask).toBeUndefined(); // Der erledigte Auftrag kann nichts mehr ausliefern.
    const weapon = craftItem(finished, "d1", "weapon"); // Prueft das Waffenrezept mit demselben Zwerg.
    expect(weapon.resources).toMatchObject({ wood: 5, stone: 4, weapons: 0 }); // Waffen verbrauchen zwei Holz und vier Stein beim Start.
    const armed = advanceDay(weapon); // Legt die fertige Waffe am naechsten Tag ins Lager.
    expect(armed.resources.weapons).toBe(1); // Die Waffe gehoert der Kolonie.
    expect(advanceDay(armed).resources.weapons).toBe(1); // Weitere Tageswechsel liefern dieselbe Waffe nicht noch einmal.
  }); // Schliesst die Pruefung beider Rezeptarten ab.

  it("leaves resources and dwarves unchanged on invalid attempts", () => { // Prueft fehlende Zutaten und ungueltige Schmiede.
    const state = makeState(); // Erstellt einen Zustand mit einem verfuegbaren Zwerg.
    expect(craftItem(state, "missing", "pickaxe")).toBe(state); // Ein unbekannter Zwerg kann keinen Auftrag starten.
    const busy = craftItem(state, "d1", "axe"); // Belegt den Zwerg mit einem ersten Auftrag.
    expect(craftItem(busy, "d1", "pickaxe")).toBe(busy); // Derselbe Zwerg kann nicht parallel noch etwas schmieden.
    state.residents[0].status = "expedition"; // Markiert den Zwerg als unterwegs.
    expect(craftItem(state, "d1", "pickaxe")).toBe(state); // Ein reisender Zwerg bleibt auf Expedition.
    state.residents[0].status = "working"; // Gibt den Zwerg wieder fuer die Materialtests frei.
    state.resources.stone = 0; // Entfernt nur den Stein aus dem Vorrat.
    expect(craftItem(state, "d1", "pickaxe")).toBe(state); // Fehlender Stein verhindert den Start.
    state.resources.stone = 10; // Stellt den Steinvorrat wieder her.
    state.resources.wood = 0; // Entfernt stattdessen das Holz.
    expect(craftItem(state, "d1", "weapon")).toBe(state); // Fehlendes Holz verhindert ebenfalls den Start.
  }); // Schliesst die Pruefung fehlgeschlagener Auftraege ab.
});

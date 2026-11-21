import { describe, expect, it } from "vitest";
import { craftItem, equipTool, returnTool } from "./equipment";
import { advanceDay, dailyResourceChange } from "./simulation";
import type { ColonyState, JobType, ResourceKey, ToolType } from "./types";

function makeState(): ColonyState {
  return {
    day: 1,
    resources: { wood: 10, stone: 10, food: 5, weapons: 0 },
    toolStock: { axe: 1, pickaxe: 1, mushroomSickle: 1 },
    dwarves: [{ id: "d1", name: "Brom", title: "", icon: "", assignment: "woodcutting", status: "working", equippedTool: null }],
  }; // Jeder Test beginnt mit demselben unabhaengigen Spielstand.
}

describe("colony simulation", () => {
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
    state.dwarves[0].assignment = job;
    state.dwarves[0].equippedTool = tool;
    expect(dailyResourceChange(state)[resource]).toBe(expected);
  });

  it("does not give a bonus for the wrong job or for travel", () => {
    const state = makeState();
    state.dwarves[0].equippedTool = "pickaxe";
    expect(dailyResourceChange(state).wood).toBe(3); // Die Spitzhacke hilft nicht beim Holzfaellen.
    state.dwarves[0].status = "expedition";
    expect(dailyResourceChange(state).wood).toBe(0); // Reisende produzieren auch mit Werkzeug nichts.
  });
});

describe("equipment and recipes", () => {
  it("moves one tool between the free stock and one dwarf", () => {
    const state = makeState();
    const equipped = equipTool(state, "d1", "axe");
    expect(equipped.toolStock.axe).toBe(0);
    expect(equipped.dwarves[0].equippedTool).toBe("axe");
    expect(equipTool(equipped, "d1", "axe")).toBe(equipped); // Dasselbe Werkzeug kann nicht doppelt ausgegeben werden.
    const returned = returnTool(equipped, "d1");
    expect(returned.toolStock.axe).toBe(1);
    expect(returned.dwarves[0].equippedTool).toBeNull();
  });

  it("swaps tools without changing their combined number", () => {
    const withAxe = equipTool(makeState(), "d1", "axe");
    const withPickaxe = equipTool(withAxe, "d1", "pickaxe");
    expect(withPickaxe.toolStock).toMatchObject({ axe: 1, pickaxe: 0 });
    expect(withPickaxe.dwarves[0].equippedTool).toBe("pickaxe");
  });

  it("rejects equipment changes while the dwarf is away", () => {
    const state = makeState();
    state.dwarves[0].status = "expedition";
    expect(equipTool(state, "d1", "axe")).toBe(state);
  });

  it("crafts a specific tool and a stored weapon", () => {
    const axe = craftItem(makeState(), "axe");
    expect(axe.resources).toMatchObject({ wood: 7, stone: 8, weapons: 0 });
    expect(axe.toolStock.axe).toBe(2);
    const weapon = craftItem(axe, "weapon");
    expect(weapon.resources).toMatchObject({ wood: 3, stone: 5, weapons: 1 });
  });

  it("does not craft when either material is missing", () => {
    const state = makeState();
    state.resources.stone = 0;
    expect(craftItem(state, "pickaxe")).toBe(state); // Verhindert den bisherigen negativen Steinbestand.
  });
});

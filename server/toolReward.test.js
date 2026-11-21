import { describe, expect, it } from "vitest";
import { toolTypes } from "../src/equipment";
import { expeditionTools, randomTool } from "./toolReward.js";

describe("random expedition tool", () => {
  it("uses the same tool types as the colony", () => {
    expect(expeditionTools).toEqual(toolTypes); // Verhindert, dass die API eine unbekannte Werkzeugart auslost.
  });

  it("can select every valid tool type", () => {
    expect(randomTool(() => 0)).toBe("axe");
    expect(randomTool(() => 1 / 3)).toBe("pickaxe");
    expect(randomTool(() => 2 / 3)).toBe("mushroomSickle");
  }); // Kontrollierte Zufallswerte pruefen die Grenzen ohne einen unstabilen Test.
});

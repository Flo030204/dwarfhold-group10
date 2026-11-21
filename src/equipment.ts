import type { ColonyState, JobType, ToolType } from "./types";

export const toolTypes: ToolType[] = ["axe", "pickaxe", "mushroomSickle"]; // Bestimmt die Reihenfolge in Schmiede und Lager.

export const toolDetails: Record<ToolType, {
  label: string;
  icon: string;
  job: Exclude<JobType, null>;
  cost: { wood: number; stone: number };
}> = {
  axe: { label: "Axe", icon: "🪓", job: "woodcutting", cost: { wood: 3, stone: 2 } },
  pickaxe: { label: "Pickaxe", icon: "⛏️", job: "mining", cost: { wood: 2, stone: 3 } },
  mushroomSickle: { label: "Mushroom sickle", icon: "🍄", job: "farming", cost: { wood: 2, stone: 1 } },
}; // Jedes Werkzeug hat genau einen passenden Job und ein eigenes Rezept.

export const weaponRecipe = { wood: 4, stone: 3 }; // Waffen bleiben im gemeinsamen Lager fuer spaetere Angriffe.

export type CraftItem = ToolType | "weapon";

export function equipTool(state: ColonyState, dwarfId: string, tool: ToolType): ColonyState {
  const dwarf = state.dwarves.find((item) => item.id === dwarfId); // Prueft den aktuellen Besitzer im selben Spielstand wie den Lagerbestand.
  if (state.foodShortage?.daysRemaining === 0 || !dwarf || dwarf.status === "expedition" || dwarf.equippedTool === tool || state.toolStock[tool] < 1) return state; // Ungueltige Aktionen veraendern nichts.

  const toolStock = { ...state.toolStock, [tool]: state.toolStock[tool] - 1 }; // Das neue Werkzeug verlaesst das freie Lager.
  if (dwarf.equippedTool) toolStock[dwarf.equippedTool] += 1; // Beim Tausch wird das alte Werkzeug zurueckgelegt.

  return {
    ...state,
    toolStock,
    dwarves: state.dwarves.map((item) => item.id === dwarfId ? { ...item, equippedTool: tool } : item), // Nur der gewaehlte Zwerg bekommt das Werkzeug.
  };
}

export function returnTool(state: ColonyState, dwarfId: string): ColonyState {
  const dwarf = state.dwarves.find((item) => item.id === dwarfId); // Liest die tatsaechlich getragene Werkzeugart.
  if (state.foodShortage?.daysRemaining === 0 || !dwarf?.equippedTool || dwarf.status === "expedition") return state; // Ohne Werkzeug oder auf Reise gibt es nichts zurueckzugeben.

  return {
    ...state,
    toolStock: { ...state.toolStock, [dwarf.equippedTool]: state.toolStock[dwarf.equippedTool] + 1 }, // Genau ein Werkzeug geht ins Lager zurueck.
    dwarves: state.dwarves.map((item) => item.id === dwarfId ? { ...item, equippedTool: null } : item),
  };
}

export function craftItem(state: ColonyState, item: CraftItem): ColonyState {
  const cost = item === "weapon" ? weaponRecipe : toolDetails[item].cost; // Beide Rezeptarten benutzen dieselbe Materialpruefung.
  if (state.foodShortage?.daysRemaining === 0 || state.resources.wood < cost.wood || state.resources.stone < cost.stone) return state; // Weder Rohstoffe noch Produkte duerfen bei einem Fehlversuch wechseln.

  return {
    ...state,
    resources: {
      ...state.resources,
      wood: state.resources.wood - cost.wood,
      stone: state.resources.stone - cost.stone,
      weapons: state.resources.weapons + (item === "weapon" ? 1 : 0), // Nur das Waffenrezept erhoeht den Waffenbestand.
    },
    toolStock: item === "weapon" ? state.toolStock : { ...state.toolStock, [item]: state.toolStock[item] + 1 }, // Werkzeuge werden nach ihrer Art gelagert.
  };
}

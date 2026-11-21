import type { ColonyState, CraftItem, Dwarf, JobType, ToolType } from "./types"; // Bindet Auftraege an die vorhandenen Zwerge und Rezepte.

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

export const weaponRecipe = { wood: 2, stone: 4 }; // Waffen bleiben im gemeinsamen Lager fuer spaetere Angriffe.

export function isAvailable(dwarf: Dwarf): boolean { // Bestimmt, ob ein Zwerg eine lokale Aufgabe wechseln oder aufbrechen darf.
  return dwarf.status === "idle" || dwarf.status === "working"; // Auf Expedition oder beim Schmieden ist der Zwerg bereits belegt.
} // Schliesst die gemeinsame Verfuegbarkeitspruefung ab.

export function craftLabel(item: CraftItem): string { // Liefert den Anzeigenamen fuer jeden Schmiedeauftrag.
  return item === "weapon" ? "Weapon" : toolDetails[item].label; // Verwendet bei Werkzeugen den bestehenden Namen.
} // Schliesst die Namensabfrage ab.

export function equipTool(state: ColonyState, dwarfId: string, tool: ToolType): ColonyState {
  const dwarf = state.dwarves.find((item) => item.id === dwarfId); // Prueft den aktuellen Besitzer im selben Spielstand wie den Lagerbestand.
  if (state.foodShortage?.daysRemaining === 0 || !dwarf || !isAvailable(dwarf) || dwarf.equippedTool === tool || state.toolStock[tool] < 1) return state; // Ungueltige Aktionen veraendern nichts.

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
  if (state.foodShortage?.daysRemaining === 0 || !dwarf?.equippedTool || !isAvailable(dwarf)) return state; // Ohne Werkzeug oder auf Reise gibt es nichts zurueckzugeben.

  return {
    ...state,
    toolStock: { ...state.toolStock, [dwarf.equippedTool]: state.toolStock[dwarf.equippedTool] + 1 }, // Genau ein Werkzeug geht ins Lager zurueck.
    dwarves: state.dwarves.map((item) => item.id === dwarfId ? { ...item, equippedTool: null } : item),
  };
}

export function craftItem(state: ColonyState, dwarfId: string, item: CraftItem): ColonyState { // Startet einen Auftrag mit einem bestimmten Zwerg.
  const dwarf = state.dwarves.find((candidate) => candidate.id === dwarfId); // Sucht den Zwerg im aktuellen Spielstand.
  const cost = item === "weapon" ? weaponRecipe : toolDetails[item]?.cost; // Beide Rezeptarten benutzen dieselbe Materialpruefung.
  if (!dwarf || !isAvailable(dwarf) || !cost || state.foodShortage?.daysRemaining === 0 || state.resources.wood < cost.wood || state.resources.stone < cost.stone) return state; // Bei einem ungueltigen Auftrag bleiben Materialien und Zwerge unveraendert.

  return { // Speichert Materialverbrauch und Auftrag gemeinsam.
    ...state, // Behaelt den bisherigen Spielstand als Grundlage.
    resources: { // Zieht nur die Zutaten ab.
      ...state.resources, // Behaelt Essen und Waffen bis zur Fertigstellung bei.
      wood: state.resources.wood - cost.wood, // Reserviert das Holz durch sofortigen Abzug.
      stone: state.resources.stone - cost.stone, // Reserviert den Stein durch sofortigen Abzug.
    }, // Schliesst die aktualisierten Vorraete ab.
    dwarves: state.dwarves.map((candidate) => candidate.id === dwarfId // Aendert nur den ausgewaehlten Zwerg.
      ? { ...candidate, status: "crafting", forgeTask: { item, completesOnDay: state.day + 1 } } // Belegt den Zwerg bis zum naechsten Tageswechsel.
      : candidate), // Andere Zwerge bleiben bei ihren Aufgaben.
  }; // Gibt den Spielstand ohne fertiges Produkt zurueck.
} // Schliesst den Start des Auftrags ab.

export function completeForgeTasks(state: ColonyState): ColonyState { // Liefert alle am aktuellen Tag faelligen Auftraege aus.
  const resources = { ...state.resources }; // Kopiert den Waffenbestand vor der Aenderung.
  const toolStock = { ...state.toolStock }; // Kopiert das freie Werkzeuglager vor der Aenderung.
  const dwarves = state.dwarves.map((dwarf): Dwarf => { // Prueft jeden Zwerg auf einen fertigen Auftrag.
    const task = dwarf.forgeTask; // Liest Rezept und Fertigstellungstag.
    if (!task || task.completesOnDay > state.day) return dwarf; // Laesst laufende und nicht vorhandene Auftraege in Ruhe.
    if (task.item === "weapon") resources.weapons += 1; // Legt eine fertige Waffe ins gemeinsame Lager.
    else toolStock[task.item] += 1; // Legt ein fertiges Werkzeug ins freie Lager seiner Art.
    return { ...dwarf, status: dwarf.assignment ? "working" : "idle", forgeTask: undefined }; // Gibt den Zwerg frei und verhindert eine doppelte Auslieferung.
  }); // Schliesst die Liste der aktualisierten Zwerge ab.
  return { ...state, resources, toolStock, dwarves }; // Liefert Produkte und freigegebene Zwerge gemeinsam aus.
} // Schliesst die Fertigstellung beim Tageswechsel ab.

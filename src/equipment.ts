import type { ColonyState, CraftItem, JobType, Resident, ToolType } from "./types";
import { forgeDays } from "./residents";

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

export function isAvailable(resident: Resident): boolean { // Bestimmt, ob ein Bewohner eine lokale Aufgabe wechseln oder aufbrechen darf.
  return resident.status === "idle" || resident.status === "working"; // Auf Expedition oder beim Schmieden ist er bereits belegt.
} // Schliesst die gemeinsame Verfuegbarkeitspruefung ab.

export function craftLabel(item: CraftItem): string { // Liefert den Anzeigenamen fuer jeden Schmiedeauftrag.
  return item === "weapon" ? "Weapon" : toolDetails[item].label; // Verwendet bei Werkzeugen den bestehenden Namen.
} // Schliesst die Namensabfrage ab.

export function equipTool(state: ColonyState, residentId: string, tool: ToolType): ColonyState {
  const resident = state.residents.find((item) => item.id === residentId); // Prueft den aktuellen Besitzer im selben Spielstand wie den Lagerbestand.
  if (state.foodShortage?.daysRemaining === 0 || !resident || !isAvailable(resident) || resident.equippedTool === tool || state.toolStock[tool] < 1) return state; // Ungueltige Aktionen veraendern nichts.

  const toolStock = { ...state.toolStock, [tool]: state.toolStock[tool] - 1 }; // Das neue Werkzeug verlaesst das freie Lager.
  if (resident.equippedTool) toolStock[resident.equippedTool] += 1; // Beim Tausch wird das alte Werkzeug zurueckgelegt.

  return {
    ...state,
    toolStock,
    residents: state.residents.map((item) => item.id === residentId ? { ...item, equippedTool: tool } : item), // Nur der gewaehlte Bewohner bekommt das Werkzeug.
  };
}

export function returnTool(state: ColonyState, residentId: string): ColonyState {
  const resident = state.residents.find((item) => item.id === residentId); // Liest die tatsaechlich getragene Werkzeugart.
  if (state.foodShortage?.daysRemaining === 0 || !resident?.equippedTool || !isAvailable(resident)) return state; // Ohne Werkzeug oder auf Reise gibt es nichts zurueckzugeben.

  return {
    ...state,
    toolStock: { ...state.toolStock, [resident.equippedTool]: state.toolStock[resident.equippedTool] + 1 }, // Genau ein Werkzeug geht ins Lager zurueck.
    residents: state.residents.map((item) => item.id === residentId ? { ...item, equippedTool: null } : item),
  };
}

export function craftItem(state: ColonyState, residentId: string, item: CraftItem): ColonyState { // Startet einen Auftrag mit einem bestimmten Bewohner.
  const resident = state.residents.find((candidate) => candidate.id === residentId); // Sucht den Schmied im aktuellen Spielstand.
  const cost = item === "weapon" ? weaponRecipe : toolDetails[item]?.cost; // Beide Rezeptarten benutzen dieselbe Materialpruefung.
  if (!resident || !isAvailable(resident) || !cost || state.foodShortage?.daysRemaining === 0 || state.resources.wood < cost.wood || state.resources.stone < cost.stone) return state; // Beide Spezies duerfen alle Rezepte starten.

  return { // Speichert Materialverbrauch und Auftrag gemeinsam.
    ...state, // Behaelt den bisherigen Spielstand als Grundlage.
    resources: { // Zieht nur die Zutaten ab.
      ...state.resources, // Behaelt Essen und Waffen bis zur Fertigstellung bei.
      wood: state.resources.wood - cost.wood, // Reserviert das Holz durch sofortigen Abzug.
      stone: state.resources.stone - cost.stone, // Reserviert den Stein durch sofortigen Abzug.
    }, // Schliesst die aktualisierten Vorraete ab.
    residents: state.residents.map((candidate) => candidate.id === residentId // Aendert nur den ausgewaehlten Schmied.
      ? { ...candidate, status: "crafting", forgeTask: { item, completesOnDay: state.day + forgeDays[resident.species] } } // Elf: sieben Tage; Zwerg: ein Tag.
      : candidate), // Andere Zwerge bleiben bei ihren Aufgaben.
  }; // Gibt den Spielstand ohne fertiges Produkt zurueck.
} // Schliesst den Start des Auftrags ab.

export function completeForgeTasks(state: ColonyState): ColonyState { // Liefert alle am aktuellen Tag faelligen Auftraege aus.
  const resources = { ...state.resources }; // Kopiert den Waffenbestand vor der Aenderung.
  const toolStock = { ...state.toolStock }; // Kopiert das freie Werkzeuglager vor der Aenderung.
  const residents = state.residents.map((resident): Resident => { // Prueft jeden Bewohner auf einen fertigen Auftrag.
    const task = resident.forgeTask; // Liest Rezept und Fertigstellungstag.
    if (!task || task.completesOnDay > state.day) return resident; // Laesst laufende und nicht vorhandene Auftraege in Ruhe.
    if (task.item === "weapon") resources.weapons += 1; // Legt eine fertige Waffe ins gemeinsame Lager.
    else toolStock[task.item] += 1; // Legt ein fertiges Werkzeug ins freie Lager seiner Art.
    return { ...resident, status: resident.assignment ? "working" : "idle", forgeTask: undefined }; // Gibt den Schmied frei und verhindert eine doppelte Auslieferung.
  }); // Schliesst die Liste der aktualisierten Zwerge ab.
  return { ...state, resources, toolStock, residents }; // Liefert Produkte und freigegebene Bewohner gemeinsam aus.
} // Schliesst die Fertigstellung beim Tageswechsel ab.

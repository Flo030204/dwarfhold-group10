import type { ColonyState, Dwarf, JobType, Resources } from "./types"; // Dwarf wird fuer die Pruefung der Verfuegbarkeit gebraucht.
import { toolDetails } from "./equipment";

export const production: Record<Exclude<JobType, null>, Partial<Resources>> = {
  woodcutting: { wood: 3 }, mining: { stone: 2 }, farming: { food: 4 },
};

export const foodGraceDays = 3; // Legt die Anzahl weiterer Spieltage bei leeren Vorraeten fest.

export function workingAssignment(dwarf: Dwarf): JobType { // Ermittelt die Aufgabe, die heute Rohstoffe produziert.
  return dwarf.status === "working" ? dwarf.assignment : null; // Nur vor Ort arbeitende Zwerge produzieren.
} // Beendet die Abfrage der aktiven Aufgabe.

export function dailyResourceChange(state: ColonyState): Resources { // Berechnet Produktion und Mahlzeiten fuer Simulation und Anzeige.
  const resources: Resources = { wood: 0, stone: 0, food: -state.dwarves.length, weapons: 0 }; // Jeder Zwerg braucht eine Ration, auch auf Expedition.

  state.dwarves.forEach((dwarf) => {
    const assignment = workingAssignment(dwarf); // Prueft, ob der Zwerg gerade seiner lokalen Arbeit nachgeht.
    if (!assignment) return; // Ueberspringt Zwerge ohne aktive Arbeit.

    const output = production[assignment]; // Liest die Tagesproduktion fuer diese Aufgabe.
    const [resource, amount] = Object.entries(output)[0] as [keyof Resources, number]; // Jeder Job erzeugt genau eine Rohstoffart.
    const toolBonus = dwarf.equippedTool && toolDetails[dwarf.equippedTool].job === assignment ? 1 : 0; // Nur das passende Werkzeug gibt einen Zusatzpunkt.
    resources[resource] += amount + toolBonus; // Unpassende oder reisende Zwerge bekommen keinen Werkzeugbonus.

  });

  return resources; // Gibt die Nettoveraenderung aller Rohstoffe zurueck.
} // Beendet die Berechnung der Tagesbilanz.

export function advanceDay(state: ColonyState): ColonyState { // Wendet die Tagesbilanz auf den Vorrat an.
  const shortage = state.foodShortage; // Liest eine eventuell bereits laufende Frist.
  if (shortage && (!shortage.acknowledged || shortage.daysRemaining === 0)) return state; // Stoppt die Zeit beim Popup und bei Game Over.

  const change = dailyResourceChange(state); // Holt dieselbe Bilanz wie in der Produktionsanzeige.
  const resources = { // Erstellt die neuen Vorraete aus Bestand und Tagesbilanz.
    wood: state.resources.wood + change.wood, // Addiert produziertes Holz.
    stone: state.resources.stone + change.stone, // Addiert produzierten Stein.
    food: Math.max(0, state.resources.food + change.food), // Zieht Mahlzeiten ab und begrenzt Essen auf mindestens null.
    weapons: state.resources.weapons + change.weapons, // Waffen werden nicht durch Tagesarbeit erzeugt.
  }; // Schliesst das Objekt der neuen Vorraete.
  const foodShortage = resources.food > 0 ? undefined : { // Setzt die Frist zurueck, sobald nach den Mahlzeiten Essen uebrig ist.
    daysRemaining: shortage ? shortage.daysRemaining - 1 : foodGraceDays, // Startet mit drei weiteren Tagen oder zieht einen Tag ab.
    acknowledged: shortage?.acknowledged ?? false, // Verlangt beim Beginn jeder neuen Knappheit ein OK.
  }; // Schliesst die Daten der aktuellen Knappheit.

  return { ...state, day: state.day + 1, resources, foodShortage }; // Gibt den neuen Spieltag inklusive Vorrat und Frist zurueck.
}

export const jobLabel = (job: JobType) => job ? ({ 
  woodcutting: "Woodcutting", 
  mining: "Deep Mining", 
  farming: "Mushroom Farm" 
}[job]) : "Unassigned";

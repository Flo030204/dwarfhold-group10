import type { ColonyState, JobType, Resident, Resources } from "./types";
import { completeForgeTasks, toolDetails } from "./equipment"; // Die Schmiede liefert ihre Produkte am Ende des Tageswechsels aus.
import { canWork } from "./residents";

export const production: Record<Exclude<JobType, null>, Partial<Resources>> = {
  woodcutting: { wood: 3 }, mining: { stone: 2 }, farming: { food: 4 },
};

export const foodGraceDays = 3; // Legt die Anzahl weiterer Spieltage bei leeren Vorraeten fest.

export function workingAssignment(resident: Resident): JobType { // Ermittelt die Aufgabe, die heute Rohstoffe produziert.
  return resident.status === "working" && canWork(resident, resident.assignment) ? resident.assignment : null; // Unmoegliche Elfenjobs und beschaeftigte Bewohner erzeugen nichts.
} // Beendet die Abfrage der aktiven Aufgabe.

export function residentProduction(resident: Resident): Partial<Resources> {
  const assignment = workingAssignment(resident); // Wendet Status und Speziesregel vor jedem Bonus an.
  if (!assignment) return {}; // Ein Elf mit Holz- oder Steinjob bleibt auch mit Werkzeug bei null.
  const [resource, amount] = Object.entries(production[assignment])[0] as [keyof Resources, number];
  const speciesAmount = resident.species === "elf" ? amount * 2 : amount; // 100 Prozent mehr Nahrung bedeuten acht statt vier Einheiten.
  const toolBonus = resident.equippedTool && toolDetails[resident.equippedTool].job === assignment ? 1 : 0; // Die Pilzsichel addiert danach genau eine Einheit.
  return { [resource]: speciesAmount + toolBonus }; // Dieselbe Zahl wird fuer Tageswechsel und UI verwendet.
}

export function dailyResourceChange(state: ColonyState): Resources { // Berechnet Produktion und Mahlzeiten fuer Simulation und Anzeige.
  const resources: Resources = { wood: 0, stone: 0, food: -state.residents.length, weapons: 0 }; // Auch der Elf verbraucht taeglich eine Ration.

  state.residents.forEach((resident) => {
    Object.entries(residentProduction(resident)).forEach(([resource, amount]) => {
      resources[resource as keyof Resources] += amount ?? 0; // Addiert nur den fuer diese Spezies tatsaechlich moeglichen Ertrag.
    });
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

  return completeForgeTasks({ ...state, day: state.day + 1, resources, foodShortage }); // Liefert erst nach der Tagesproduktion faellige Schmiedeauftraege aus.
}

export const jobLabel = (job: JobType) => job ? ({ 
  woodcutting: "Woodcutting", 
  mining: "Deep Mining", 
  farming: "Mushroom Farm" 
}[job]) : "Unassigned";

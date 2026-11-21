import { isAvailable, toolDetails } from "./equipment";
import type { ColonyState, Dwarf, ExpeditionResult, ResourceKey } from "./types";

const rewardResources: ResourceKey[] = ["wood", "stone", "food", "weapons"]; // Nur diese Lagerwerte duerfen durch eine API-Antwort steigen.

function returnTraveler(state: ColonyState, dwarfId: string): Dwarf[] {
  return state.dwarves.map((dwarf) => dwarf.id === dwarfId && dwarf.status === "expedition"
    ? { ...dwarf, status: dwarf.assignment ? "working" : "idle" }
    : dwarf); // Bei der Rueckkehr bleibt equippedTool null; das abgelegte Werkzeug gehoert weiter zum Lager.
}

export function startExpedition(state: ColonyState, dwarfId: string, destination: string, requestId: string): ColonyState {
  const dwarf = state.dwarves.find((item) => item.id === dwarfId); // Prueft den Zwerg im aktuellen Spielstand statt in einem alten React-Render.
  if (state.activeExpedition || state.foodShortage?.daysRemaining === 0 || !dwarf || !isAvailable(dwarf) || !destination || !requestId) return state; // Ungueltige oder wiederholte Starts aendern nichts.

  const toolStock = dwarf.equippedTool
    ? { ...state.toolStock, [dwarf.equippedTool]: state.toolStock[dwarf.equippedTool] + 1 }
    : state.toolStock; // Ein getragenes Werkzeug geht vor dem Aufbruch genau einmal ins freie Lager.

  return {
    ...state,
    toolStock,
    activeExpedition: { requestId, dwarfId, destination }, // Diese Kennung ordnet die spaetere Antwort dem angenommenen Auftrag zu.
    dwarves: state.dwarves.map((item) => item.id === dwarfId
      ? { ...item, status: "expedition", equippedTool: null }
      : item), // Der Scout reist ohne Werkzeug; seine bisherige Arbeitszuweisung bleibt fuer die Rueckkehr erhalten.
    lastExpeditionEvent: {
      id: `${requestId}:start`, day: state.day,
      message: `${dwarf.name} departed for ${destination.replaceAll("-", " ")}. Any equipped tool was returned to storage.`,
    }, // Die Chronik bekommt nur nach einem tatsaechlich angenommenen Start eine Meldung.
  };
}

export function finishExpeditionSuccess(state: ColonyState, requestId: string, result: ExpeditionResult): ColonyState {
  const active = state.activeExpedition; // Eine alte Antwort darf keinen neueren Auftrag abschliessen.
  if (!active || active.requestId !== requestId) return state;
  if (state.foodShortage?.daysRemaining === 0) return finishExpeditionFailure(state, requestId, "The expedition returned after Stonehome fell. No rewards were added."); // Game Over friert die Beute ein.

  const traveler = state.dwarves.find((dwarf) => dwarf.id === active.dwarfId);
  if (traveler?.status !== "expedition") return finishExpeditionFailure(state, requestId, "The expedition could not be completed because the scout was no longer travelling."); // Ein widerspruechlicher Status vergibt keine Beute.

  const resources = { ...state.resources }; // Erstellt eine Kopie, damit der alte Spielstand unveraendert bleibt.
  for (const key of rewardResources) resources[key] += result.rewards[key] ?? 0; // Nur gepruefte, bekannte Rohstoffarten werden gutgeschrieben.
  const toolStock = result.toolReward
    ? { ...state.toolStock, [result.toolReward]: state.toolStock[result.toolReward] + 1 }
    : state.toolStock; // Eine gefundene Werkzeugart wird erst beim gueltigen Abschluss gutgeschrieben.

  return {
    ...state,
    resources,
    toolStock,
    dwarves: returnTraveler(state, active.dwarfId),
    activeExpedition: undefined, // Ohne aktiven Auftrag kann dieselbe Antwort nichts ein zweites Mal vergeben.
    lastExpeditionEvent: {
      id: `${requestId}:success`, day: state.day, tone: "good",
      message: result.toolReward ? `${result.message} Found: ${toolDetails[result.toolReward].label}.` : result.message,
    },
  };
}

export function finishExpeditionFailure(state: ColonyState, requestId: string, message: string): ColonyState {
  const active = state.activeExpedition;
  if (!active || active.requestId !== requestId) return state; // Ein spaeter Fehler darf weder einen neuen Scout freigeben noch dessen Zustand aendern.

  return {
    ...state,
    dwarves: returnTraveler(state, active.dwarfId),
    activeExpedition: undefined,
    lastExpeditionEvent: { id: `${requestId}:failure`, day: state.day, message, tone: "warning" }, // Fehlversuche veraendern keine Lagerbestaende.
  };
}

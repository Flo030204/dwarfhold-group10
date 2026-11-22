import { isAvailable, toolDetails } from "./equipment";
import { elfResident } from "./residents";
import type { ColonyState, ExpeditionResult, Resident, ResourceKey } from "./types";

const rewardResources: ResourceKey[] = ["wood", "stone", "food", "weapons"]; // Nur diese Lagerwerte duerfen durch eine API-Antwort steigen.

function returnTraveler(state: ColonyState, residentId: string): Resident[] {
  return state.residents.map((resident) => resident.id === residentId && resident.status === "expedition"
    ? { ...resident, status: resident.assignment ? "working" : "idle" }
    : resident); // Bei der Rueckkehr bleibt equippedTool null; das abgelegte Werkzeug gehoert weiter zum Lager.
}

export function startExpedition(state: ColonyState, residentId: string, destination: string, requestId: string): ColonyState {
  const resident = state.residents.find((item) => item.id === residentId); // Prueft den Bewohner im aktuellen Spielstand statt in einem alten React-Render.
  if (state.activeExpedition || state.foodShortage?.daysRemaining === 0 || !resident || !isAvailable(resident) || !destination || !requestId) return state; // Ungueltige oder wiederholte Starts aendern nichts.

  const toolStock = resident.equippedTool
    ? { ...state.toolStock, [resident.equippedTool]: state.toolStock[resident.equippedTool] + 1 }
    : state.toolStock; // Ein getragenes Werkzeug geht vor dem Aufbruch genau einmal ins freie Lager.

  return {
    ...state,
    toolStock,
    activeExpedition: { requestId, residentId, destination }, // Diese Kennung ordnet die spaetere Antwort dem angenommenen Auftrag zu.
    residents: state.residents.map((item) => item.id === residentId
      ? { ...item, status: "expedition", equippedTool: null }
      : item), // Der Scout reist ohne Werkzeug; seine bisherige Arbeitszuweisung bleibt fuer die Rueckkehr erhalten.
    lastExpeditionEvent: {
      id: `${requestId}:start`, day: state.day,
      message: `${resident.name} departed for ${destination.replaceAll("-", " ")}. Any equipped tool was returned to storage.`,
    }, // Die Chronik bekommt nur nach einem tatsaechlich angenommenen Start eine Meldung.
  };
}

export function finishExpeditionSuccess(state: ColonyState, requestId: string, result: ExpeditionResult): ColonyState {
  const active = state.activeExpedition; // Eine alte Antwort darf keinen neueren Auftrag abschliessen.
  if (!active || active.requestId !== requestId) return state;
  if (state.foodShortage?.daysRemaining === 0) return finishExpeditionFailure(state, requestId, "The expedition returned after Stonehome fell. No rewards were added."); // Game Over friert die Beute ein.

  const traveler = state.residents.find((resident) => resident.id === active.residentId);
  if (traveler?.status !== "expedition") return finishExpeditionFailure(state, requestId, "The expedition could not be completed because the scout was no longer travelling."); // Ein widerspruechlicher Status vergibt keine Beute.

  const resources = { ...state.resources }; // Erstellt eine Kopie, damit der alte Spielstand unveraendert bleibt.
  for (const key of rewardResources) resources[key] += result.rewards[key] ?? 0; // Nur gepruefte, bekannte Rohstoffarten werden gutgeschrieben.
  const toolStock = result.toolReward
    ? { ...state.toolStock, [result.toolReward]: state.toolStock[result.toolReward] + 1 }
    : state.toolStock; // Eine gefundene Werkzeugart wird erst beim gueltigen Abschluss gutgeschrieben.

  const elfJoins = active.destination === "crystal-cave" && !state.residents.some((resident) => resident.species === "elf"); // Nur der erste erfolgreiche Hoehlenbesuch bringt Liora in die Kolonie.
  return {
    ...state,
    resources,
    toolStock,
    residents: elfJoins ? [...returnTraveler(state, active.residentId), { ...elfResident }] : returnTraveler(state, active.residentId), // Der Beitritt geschieht zusammen mit der Beute und nie doppelt.
    activeExpedition: undefined, // Ohne aktiven Auftrag kann dieselbe Antwort nichts ein zweites Mal vergeben.
    lastExpeditionEvent: {
      id: `${requestId}:success`, day: state.day, tone: "good",
      message: `${result.toolReward ? `${result.message} Found: ${toolDetails[result.toolReward].label}.` : result.message}${elfJoins ? ` ${elfResident.name} joined the hold.` : ""}`, // Die Chronik nennt den neuen Bewohner beim ersten Erfolg.
    },
  };
}

export function finishExpeditionFailure(state: ColonyState, requestId: string, message: string): ColonyState {
  const active = state.activeExpedition;
  if (!active || active.requestId !== requestId) return state; // Ein spaeter Fehler darf weder einen neuen Scout freigeben noch dessen Zustand aendern.

  return {
    ...state,
    residents: returnTraveler(state, active.residentId),
    activeExpedition: undefined,
    lastExpeditionEvent: { id: `${requestId}:failure`, day: state.day, message, tone: "warning" }, // Fehlversuche veraendern keine Lagerbestaende.
  };
}

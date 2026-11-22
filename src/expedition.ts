import { isAvailable, toolDetails } from "./equipment";
import { foodGraceDays } from "./simulation"; // Startet bei leer gepluenderten Vorraeten dieselbe Hungerfrist wie der Tageswechsel.
import { elfResident } from "./residents";
import type { ColonyState, ExpeditionResult, Resident, ResourceKey } from "./types";

const rewardResources: ResourceKey[] = ["wood", "stone", "food", "weapons"]; // Nur diese Lagerwerte duerfen durch eine API-Antwort steigen.

export const spiderCave = "spider-cave"; // Kennzeichnet das Ziel, dessen Rueckkehr einen Angriff ausloest.
export const defenseWeapons = 12; // So viele Waffen werden zur erfolgreichen Abwehr verbraucht.
export const spiderRaid = { food: 20, stone: 15, wood: 15 }; // Begrenzt die zusaetzliche Pluenderung des bisherigen Vorrats.

function returnTraveler(state: ColonyState, residentId: string): Resident[] {
  return state.residents.map((resident) => resident.id === residentId && resident.status === "expedition"
    ? { ...resident, status: resident.assignment ? "working" : "idle" }
    : resident); // Bei der Rueckkehr bleibt equippedTool null; das abgelegte Werkzeug gehoert weiter zum Lager.
}

export function startExpedition(state: ColonyState, residentId: string, destination: string, requestId: string): ColonyState {
  const resident = state.residents.find((item) => item.id === residentId); // Prueft den Bewohner im aktuellen Spielstand statt in einem alten React-Render.
  if (state.activeExpedition || state.raidPopup || state.foodShortage?.daysRemaining === 0 || !resident || !isAvailable(resident) || !destination || !requestId) return state; // Ungueltige oder wiederholte Starts aendern nichts.

  const toolStock = resident.equippedTool
    ? { ...state.toolStock, [resident.equippedTool]: state.toolStock[resident.equippedTool] + 1 }
    : state.toolStock; // Ein getragenes Werkzeug geht vor dem Aufbruch genau einmal ins freie Lager.

  return {
    ...state,
    toolStock,
    activeExpedition: { requestId, residentId, destination, returnsOnDay: state.day + 1 }, // Die Reise dauert wie ein Zwergenauftrag einen Spieltag.
    residents: state.residents.map((item) => item.id === residentId
      ? { ...item, status: "expedition", equippedTool: null }
      : item), // Der Scout reist ohne Werkzeug; seine bisherige Arbeitszuweisung bleibt fuer die Rueckkehr erhalten.
    lastExpeditionEvent: {
      id: `${requestId}:start`, day: state.day,
      message: `${resident.name} departed for ${destination.replaceAll("-", " ")}. Any equipped tool was returned to storage.`,
    }, // Die Chronik bekommt nur nach einem tatsaechlich angenommenen Start eine Meldung.
  };
}

export function recordExpeditionSuccess(state: ColonyState, requestId: string, result: ExpeditionResult): ColonyState {
  const active = state.activeExpedition; // Eine Antwort gehoert nur zum noch offenen Auftrag.
  if (!active || active.requestId !== requestId || active.outcome) return state; // Alte und doppelte Antworten veraendern den Stand nicht.
  return { ...state, activeExpedition: { ...active, outcome: { kind: "success", result } } }; // Speichert Beute und Zufallswerkzeug bis zum Rueckkehrtag.
}

export function recordExpeditionFailure(state: ColonyState, requestId: string, message: string): ColonyState {
  const active = state.activeExpedition; // Auch ein Fehler muss dem aktuellen Scout zugeordnet sein.
  if (!active || active.requestId !== requestId || active.outcome) return state; // Ein spaeter Fehler ueberschreibt keinen Erfolg.
  return { ...state, activeExpedition: { ...active, outcome: { kind: "failure", message } } }; // Der Scout kehrt nach einem Spieltag ohne Beute zurueck.
}

export function completeDueExpedition(state: ColonyState): ColonyState {
  const active = state.activeExpedition; // Liest Reisetag und bereits empfangenen Ausgang gemeinsam.
  if (!active?.outcome || state.day < active.returnsOnDay) return state; // Pause haelt den Tag und damit die Rueckkehr an.
  return active.outcome.kind === "success"
    ? finishExpeditionSuccess(state, active.requestId, active.outcome.result) // Erst jetzt werden Beute, Elf und moeglicher Angriff verarbeitet.
    : finishExpeditionFailure(state, active.requestId, active.outcome.message); // Ein Fehlschlag gibt den Scout erst am Rueckkehrtag frei.
}

export function finishExpeditionSuccess(state: ColonyState, requestId: string, result: ExpeditionResult): ColonyState {
  const active = state.activeExpedition; // Eine alte Antwort darf keinen neueren Auftrag abschliessen.
  if (!active || active.requestId !== requestId) return state;
  if (state.foodShortage?.daysRemaining === 0) return finishExpeditionFailure(state, requestId, "The expedition returned after Stonehome fell. No rewards were added."); // Game Over friert die Beute ein.

  const traveler = state.residents.find((resident) => resident.id === active.residentId);
  if (traveler?.status !== "expedition") return finishExpeditionFailure(state, requestId, "The expedition could not be completed because the scout was no longer travelling."); // Ein widerspruechlicher Status vergibt keine Beute.

  const resources = { ...state.resources }; // Erstellt eine Kopie, damit der alte Spielstand unveraendert bleibt.
  const underAttack = active.destination === spiderCave; // Nur eine erfolgreiche Reise zur Spider Cave loest den Angriff aus.
  const repelled = underAttack && resources.weapons >= defenseWeapons; // Prueft den Waffenbestand bei der Rueckkehr vor der Gutschrift.
  const looted = underAttack && !repelled; // Ohne ausreichende Waffen gehen die Beute und Teile des Lagers verloren.
  const losses = { food: 0, stone: 0, wood: 0 }; // Sammelt die tatsaechlichen Verluste fuer die Chronik.
  const weaponsSpent = looted ? resources.weapons : defenseWeapons; // Bei gescheiterter Abwehr werden alle verfuegbaren Waffen eingesetzt.
  if (underAttack) resources.weapons -= weaponsSpent; // Verbraucht die Waffen einmalig beim Spinnenangriff.
  if (looted) { // Schreibt die Expeditionsbeute bei verlorener Abwehr gar nicht erst gut.
    for (const key of ["food", "stone", "wood"] as const) { // Pluendert nur diese drei Rohstoffe aus dem bisherigen Lager.
      losses[key] = Math.min(resources[key], spiderRaid[key]); // Zieht hoechstens ab, was im Lager liegt.
      resources[key] -= losses[key]; // Wendet den zusaetzlichen Verlust an.
    } // Schliesst die Pluenderung ab.
  } else { // Bei normalen Reisen oder erfolgreicher Abwehr kommt die Beute ins Lager.
    for (const key of rewardResources) resources[key] += result.rewards[key] ?? 0; // Schreibt die geprueften Rohstoffe gut.
  } // Schliesst die einmalige Abrechnung ab.
  const loot = `${result.rewards.food ?? 0} rations, ${result.rewards.stone ?? 0} stone and ${result.rewards.wood ?? 0} timber`; // Benennt die Beute aus der erfolgreichen Serverantwort.
  const raidReport = looted // Waehlt die sichtbare Meldung passend zum Angriffsausgang.
    ? `Spiders followed ${traveler.name} home. We failed to defend Stonehome. Weapons spent: ${weaponsSpent}. All expedition loot was lost (${loot}). The spiders also stole ${losses.food} rations, ${losses.stone} stone and ${losses.wood} timber from storage.` // Meldet verbrauchte Waffen, verlorene Beute und tatsaechliche Lagerverluste.
    : `Spiders followed ${traveler.name} home. We defended Stonehome successfully using ${defenseWeapons} weapons and kept the loot: ${loot}.`; // Meldet verbrauchte Waffen und erhaltene Beute.
  const foodShortage = !underAttack ? state.foodShortage : resources.food > 0 ? undefined // Eine erfolgreiche Rueckkehr mit Essen hebt die Hungerfrist auf.
    : (state.foodShortage ?? { daysRemaining: foodGraceDays, acknowledged: false }); // Leere Vorraete starten eine Frist oder behalten die laufende bei.
  const toolStock = !looted && result.toolReward // Bei verlorener Abwehr gibt es auch keine Werkzeugbeute.
    ? { ...state.toolStock, [result.toolReward]: state.toolStock[result.toolReward] + 1 }
    : state.toolStock; // Eine gefundene Werkzeugart wird erst beim gueltigen Abschluss gutgeschrieben.

  const elfJoins = active.destination === "crystal-cave" && !state.residents.some((resident) => resident.species === "elf"); // Nur der erste erfolgreiche Hoehlenbesuch bringt Liora in die Kolonie.
  return {
    ...state,
    resources,
    raidPopup: underAttack ? "attack" : undefined, // Oeffnet die Angriffswarnung nur nach einer erfolgreichen Reise zur Spinnenhoehle.
    foodShortage, // Speichert bei einem Angriff auch die Auswirkung auf die Hungerfrist.
    toolStock,
    residents: elfJoins ? [...returnTraveler(state, active.residentId), { ...elfResident }] : returnTraveler(state, active.residentId), // Der Beitritt geschieht zusammen mit der Beute und nie doppelt.
    activeExpedition: undefined, // Ohne aktiven Auftrag kann dieselbe Antwort nichts ein zweites Mal vergeben.
    lastExpeditionEvent: {
      id: `${requestId}:success`, day: state.day, tone: looted ? "warning" : "good", // Hebt den verlorenen Angriff als Warnung hervor.
      message: underAttack ? raidReport : `${result.toolReward ? `${result.message} Found: ${toolDetails[result.toolReward].label}.` : result.message}${elfJoins ? ` ${elfResident.name} joined the hold.` : ""}`, // Die Chronik nennt den neuen Bewohner beim ersten Erfolg.
    },
  };
}

export function acknowledgeRaid(state: ColonyState): ColonyState { // Bestaetigt die aktuell angezeigte Angriffsmeldung.
  if (!state.raidPopup) return state; // Ohne offenes Popup bleibt der Zustand gleich.
  return { ...state, raidPopup: state.raidPopup === "attack" ? "result" : undefined }; // Zeigt zuerst den Ausgang und schliesst danach das Popup.
} // Schliesst die Bestaetigung des Angriffs ab.

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

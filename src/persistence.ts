import { toolTypes } from "./equipment"; // Verwendet die im Spiel bekannten Werkzeugarten.
import { parseExpeditionResult } from "./api"; // Prueft gespeicherte API-Ergebnisse wie neue Antworten.
import { foodGraceDays } from "./simulation"; // Prueft die gespeicherte Hungerfrist gegen die Spielregel.
import { elfId, forgeDays } from "./residents"; // Prueft Elfenkennung und verbleibende Schmiededauer.
import type { Activity, ColonyState, Resident } from "./types"; // Beschreibt die wiederherstellbaren Spieldaten.

export const saveKey = "dwarfhold:colony"; // Trennt den Koloniespielstand von anderen Browserdaten.
const saveVersion = 3; // Version 3 speichert den Rueckkehrtag und bereits empfangene Expeditionsergebnisse.
const jobs = ["woodcutting", "mining", "farming"]; // Legt die gueltigen gespeicherten Arbeitszuweisungen fest.
const resourceKeys = ["wood", "stone", "food", "weapons"]; // Legt die erlaubten Lagerfelder fest.

export interface ColonySave { // Speichert den Spielzustand zusammen mit Pause und Chronik.
  colony: ColonyState; // Enthaelt auch Schmiedeauftraege und die Hungerfrist.
  paused: boolean; // Speichert die manuell eingestellte Pause.
  activities: Activity[]; // Bewahrt die letzten Meldungen der Chronik.
} // Schliesst die Beschreibung des Speicherformats ab.

function isRecord(value: unknown): value is Record<string, unknown> { // Prueft JSON-Werte vor dem Zugriff auf ihre Felder.
  return typeof value === "object" && value !== null && !Array.isArray(value); // Lehnt leere Werte und Listen als Objekte ab.
} // Schliesst die Objektpruefung ab.

function isCount(value: unknown): value is number { // Prueft Spieltage, Mengen und Restfristen.
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0; // Lehnt negative, ungenaue und gebrochene Werte ab.
} // Schliesst die Zahlenpruefung ab.

function hasStock(value: unknown, keys: readonly string[]): boolean { // Prueft Material- und Werkzeuglager.
  return isRecord(value) && Object.keys(value).length === keys.length && keys.every((key) => isCount(value[key])); // Erlaubt genau die bekannten Felder mit gueltigen Mengen.
} // Schliesst die Lagerpruefung ab.

function isActivity(value: unknown): value is Activity { // Prueft einen Chronikeintrag vor der Anzeige.
  return isRecord(value) && typeof value.id === "string" && isCount(value.day) && typeof value.message === "string" // Verlangt Kennung, Tag und Text.
    && (value.tone === undefined || value.tone === "good" || value.tone === "warning"); // Erlaubt nur gueltige Meldungsarten.
} // Schliesst die Chronikpruefung ab.

function isExpeditionOutcome(value: unknown): boolean { // Prueft den vorgemerkten Ausgang vor dem Fortsetzen einer Reise.
  if (!isRecord(value)) return false; // Ein Ergebnis muss als JSON-Objekt gespeichert sein.
  if (value.kind === "failure") return typeof value.message === "string"; // Eine gescheiterte Reise braucht nur ihren Fehlertext.
  if (value.kind !== "success") return false; // Andere Ausgangsarten sind unbekannt.
  try { parseExpeditionResult(value.result); return true; } // Dieselbe API-Pruefung verhindert ungueltige Beute aus dem Speicher.
  catch { return false; } // Beschaedigte Ergebnisse duerfen den Spielstand nicht fortsetzen.
}

function isResident(value: unknown, day: number): value is Resident { // Prueft Stammdaten und aktuelle Aufgabe beider Spezies.
  if (!isRecord(value) || typeof value.id !== "string" || !value.id || typeof value.name !== "string" // Verlangt Identitaet und Namen.
    || typeof value.title !== "string" || typeof value.icon !== "string") return false; // Verlangt die angezeigten Stammdaten.
  if (value.species !== "dwarf" && value.species !== "elf") return false; // Ohne bekannte Spezies sind Produktion und Schmiededauer unbestimmt.
  if (value.species === "elf" && (value.id !== elfId || value.assignment === "woodcutting" || value.assignment === "mining")) return false; // Der einmalige Elf darf nicht als Holz- oder Steinproduzent geladen werden.
  if (value.assignment !== null && !jobs.some((job) => job === value.assignment)) return false; // Lehnt unbekannte Aufgaben ab.
  if (value.specialty !== undefined && !jobs.some((job) => job === value.specialty)) return false; // Lehnt unbekannte Spezialisierungen ab.
  if (value.equippedTool !== null && !toolTypes.some((tool) => tool === value.equippedTool)) return false; // Lehnt unbekannte ausgeruestete Werkzeuge ab.
  if (value.status === "crafting") { // Ein schmiedender Bewohner braucht einen gueltigen Auftrag.
    const task = value.forgeTask; // Liest den gespeicherten Auftrag des Bewohners.
    const remaining = isRecord(task) && typeof task.completesOnDay === "number" ? task.completesOnDay - day : 0; // Ermittelt die nach dem Neuladen noch offenen Tage.
    return remaining >= 1 && remaining <= forgeDays[value.species] && isRecord(task) && isCount(task.completesOnDay) // Zwerg: maximal ein Tag; Elf: maximal sieben Tage.
      && (task.item === "weapon" || toolTypes.some((tool) => tool === task.item)); // Das Rezept muss im Spiel vorhanden sein.
  } // Schliesst die Pruefung laufender Schmiedeauftraege ab.
  if (value.forgeTask !== undefined) return false; // Nur ein schmiedender Zwerg darf einen Auftrag haben.
  if (value.status === "expedition") return value.equippedTool === null; // Reisende starten gemaess Reiseregel ohne Werkzeug.
  return value.status === (value.assignment === null ? "idle" : "working"); // Verlangt einen Status passend zur lokalen Zuweisung.
} // Schliesst die Zwergpruefung ab.

function isColony(value: unknown): value is ColonyState { // Prueft den gesamten gespeicherten Koloniezustand.
  if (!isRecord(value) || !isCount(value.day)) return false; // Ohne gueltigen Spieltag wird nichts geladen.
  if (!hasStock(value.resources, resourceKeys) || !hasStock(value.toolStock, toolTypes)) return false; // Beide Lager muessen vollstaendig sein.
  const day = value.day; // Haelt den geprueften Tag fuer die Auftragspruefung fest.
  const residents = value.residents; // Liest die gespeicherte Bewohnerliste.
  if (!Array.isArray(residents) || !residents.length || !residents.every((resident): resident is Resident => isResident(resident, day))) return false; // Prueft jeden Bewohner vor seiner Verwendung.
  if (new Set(residents.map((resident) => resident.id)).size !== residents.length || residents.filter((resident) => resident.species === "elf").length > 1) return false; // Lehnt doppelte Kennungen und Elfen ab.
  const shortage = value.foodShortage; // Liest die optionale Hungerfrist.
  if (shortage !== undefined && (!isRecord(shortage) || !isCount(shortage.daysRemaining) // Prueft die verbleibenden Tage.
    || shortage.daysRemaining > foodGraceDays || typeof shortage.acknowledged !== "boolean" // Beschraenkt die Frist und verlangt den OK-Status.
    || (!shortage.acknowledged && shortage.daysRemaining !== foodGraceDays))) return false; // Eine offene Warnung muss noch die volle Frist haben.
  if (value.lastExpeditionEvent !== undefined && !isActivity(value.lastExpeditionEvent)) return false; // Prueft die letzte Reisemeldung.
  if (value.raidPopup !== undefined && ((value.raidPopup !== "attack" && value.raidPopup !== "result") || !isActivity(value.lastExpeditionEvent) || value.activeExpedition !== undefined)) return false; // Laedt offene Angriffsmeldungen nur zusammen mit einem gueltigen Ausgang.
  const travelers = residents.filter((resident) => resident.status === "expedition"); // Ermittelt die zu einem Auftrag passenden Reisenden.
  const active = value.activeExpedition; // Liest den optionalen Reiseauftrag.
  if (active === undefined) return travelers.length === 0; // Ohne Auftrag darf kein Zwerg auf Reise stehen.
  return isRecord(active) && travelers.length === 1 && active.residentId === travelers[0].id // Verlangt genau den Scout des Auftrags.
    && typeof active.requestId === "string" && Boolean(active.requestId) // Verlangt eine verwendbare Auftragskennung.
    && typeof active.destination === "string" && Boolean(active.destination) // Verlangt ein Reiseziel.
    && isCount(active.returnsOnDay) && active.returnsOnDay > 0 && active.returnsOnDay <= day + 1 // Eine Reise dauert einen Spieltag und kann auf eine spaete Antwort warten.
    && (active.outcome === undefined || isExpeditionOutcome(active.outcome)); // Ein vorgemerkter Ausgang muss gueltig sein.
} // Schliesst die Koloniepruefung ab.

export function encodeSave(save: ColonySave): string { // Bereitet einen gueltigen Spielstand fuer den Browser vor.
  return JSON.stringify({ version: saveVersion, ...save }); // Speichert Zustand und Versionsnummer als einen Eintrag.
} // Schliesst das Kodieren ab.

function migrateLegacyColony(value: unknown): unknown { // Uebernimmt bestehende Spielstaende aus dem Zwergenformat der Version 1.
  if (!isRecord(value) || !Array.isArray(value.dwarves)) return value; // Die normale Validierung meldet ungueltige Altstaende.
  const { dwarves, activeExpedition, ...rest } = value; // Entfernt die alten Feldnamen vor dem Aufbau des neuen Formats.
  const residents = dwarves.map((dwarf) => isRecord(dwarf) ? { ...dwarf, species: "dwarf" } : dwarf); // Startbewohner erhalten die bisher implizite Spezies.
  const active = isRecord(activeExpedition)
    ? (({ dwarfId, ...other }) => ({ ...other, residentId: dwarfId }))(activeExpedition) // Eine laufende Reise behaelt ihre Kennung bis zum kontrollierten Abbruch.
    : activeExpedition;
  return { ...rest, residents, activeExpedition: active }; // Andere Vorraete, Aufgaben und Chronik bleiben erhalten.
}

function migrateTimedExpedition(value: unknown): unknown { // Ergaenzt fuer alte offene Reisen den bisher fehlenden Rueckkehrtag.
  if (!isRecord(value) || !isRecord(value.activeExpedition) || !isCount(value.day)) return value; // Ohne Reise bleibt der Spielstand unveraendert.
  return { ...value, activeExpedition: { ...value.activeExpedition, returnsOnDay: value.day + 1 } }; // Alte Reisen brauchen ab dem letzten gespeicherten Tag noch einen Tageswechsel.
}

export function decodeSave(raw: string): ColonySave | null { // Liest und prueft einen gespeicherten Browser-Eintrag.
  try { // Faengt beschaedigtes JSON kontrolliert ab.
    const data: unknown = JSON.parse(raw); // Behandelt gelesene Felder bis zur Pruefung als unbekannt.
    if (!isRecord(data) || (data.version !== saveVersion && data.version !== 2 && data.version !== 1)) return null; // Liest beide vorherigen Formate fuer bestehende Kolonien.
    const candidate = data.version === saveVersion ? data.colony : migrateTimedExpedition(data.version === 1 ? migrateLegacyColony(data.colony) : data.colony); // Ergaenzt alte Bewohner und offene Reisen.
    if (!isColony(candidate) // Verlangt nach der Migration einen gueltigen Spielzustand.
      || typeof data.paused !== "boolean" || !Array.isArray(data.activities) || !data.activities.every(isActivity)) return null; // Prueft auch Pause und Chronik.
    return { colony: candidate, paused: data.paused, activities: data.activities.slice(0, 6) }; // Eine Reise bleibt wie ein Schmiedeauftrag nach Reload bestehen.
  } catch { // Fehlerhafte Daten werden wie ein ungueltiger Spielstand behandelt.
    return null; // Erlaubt der Oberflaeche, eine frische Kolonie zu starten.
  } // Schliesst die Fehlerbehandlung ab.
} // Schliesst das Wiederherstellen ab.

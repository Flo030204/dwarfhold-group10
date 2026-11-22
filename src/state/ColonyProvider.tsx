import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"; // Speichert vor dem naechsten sichtbaren Render und vor dem Reisestart.
import { beginExpedition } from "../api";
import { craftItem as applyCraftItem, equipTool as applyEquipTool, returnTool as applyReturnTool, isAvailable } from "../equipment"; // Nutzt dieselbe Verfuegbarkeit wie die Schmiede.
import { finishExpeditionFailure, finishExpeditionSuccess, startExpedition } from "../expedition";
import { decodeSave, encodeSave, saveKey, type ColonySave } from "../persistence"; // Liest und schreibt das versionierte Browserformat.
import { canWork } from "../residents"; // Verhindert unmoegliche Arbeitszuweisungen fuer den Elfen.
import { advanceDay, jobLabel } from "../simulation";
import type {
  Activity,
  ColonyState,
  CraftItem, // Beschreibt die Werkzeugart oder Waffe des Auftrags.
  JobType,
  ToolType,
} from "../types";
import { ColonyContext, type ColonyContextValue } from "./ColonyContext";

const initialState: ColonyState = {
  day: 12,
  resources: {
    wood: 14,
    stone: 9,
    food: 18,
    weapons: 0,
  },
  toolStock: { axe: 0, pickaxe: 1, mushroomSickle: 0 }, // Das bisherige Startwerkzeug wird zur Spitzhacke.
  residents: [
    {
      id: "dwarf-1",
      species: "dwarf", // Alle drei Startbewohner behalten die bisherigen Zwergenregeln.
      name: "Bromli Copperkeg",
      title: "Hold Warden",
      icon: "🧔🏻",
      assignment: "mining",
      status: "working",
      equippedTool: null,
      specialty: "mining",
    },
    {
      id: "dwarf-2",
      species: "dwarf",
      name: "Yrsa Flintbraid",
      title: "Trail Scout",
      icon: "🧔🏼‍♀️",
      assignment: "woodcutting",
      status: "working",
      equippedTool: null,
      specialty: "woodcutting",
    },
    {
      id: "dwarf-3",
      species: "dwarf",
      name: "Dori Ashmantle",
      title: "Stone Singer",
      icon: "🧔🏽",
      assignment: null,
      status: "idle",
      equippedTool: null,
    },
  ],
};

const newGame: ColonySave = { // Definiert den Zustand fuer den ersten Start und fuer Restart.
  colony: initialState, // Beginnt mit den bekannten Zwergen und Vorraeten.
  paused: false, // Startet die Tagesuhr.
  activities: [{ id: "welcome", day: initialState.day, message: "The forge fires are lit. Stonehome wakes." }], // Begruesst die neue Kolonie.
}; // Schliesst den gemeinsamen Startzustand ab.

function loadGame(): { save: ColonySave; notice: string } { // Laedt vor dem ersten Render und vor dem Start der Effekte.
  try { // Der Browser kann selbst den Lesezugriff verweigern.
    const raw = window.localStorage.getItem(saveKey); // Liest nur den Spielstand dieser Kolonie.
    if (raw === null) return { save: newGame, notice: "" }; // Beim ersten Besuch ist noch kein Spielstand vorhanden.
    const save = decodeSave(raw); // Prueft den Inhalt und schliesst eine unterbrochene Reise ab.
    return save ? { save, notice: "" } : { save: newGame, notice: "The saved colony was invalid or incompatible. A fresh colony has been started." }; // Meldet einen unbrauchbaren Spielstand.
  } catch { // Bei gesperrtem Speicher bleibt das Spiel nutzbar.
    return { save: newGame, notice: "The browser could not read the saved colony. A fresh colony has been started." }; // Erklaert, warum eine neue Kolonie gestartet ist.
  } // Schliesst die Behandlung von Lesefehlern ab.
} // Schliesst das Laden ab.

export function ColonyProvider({ children }: { children: ReactNode }) {
  const [loaded] = useState(loadGame); // Laedt den Spielstand nur bei Initialisierung der Sitzung.
  const [colony, setColony] = useState(loaded.save.colony); // Startet mit der wiederhergestellten Kolonie.
  const [paused, setPaused] = useState(loaded.save.paused); // Stellt eine manuell gesetzte Pause wieder her.
  const [loadNotice, setLoadNotice] = useState(loaded.notice); // Haelt den Hinweis zu einem unlesbaren Spielstand sichtbar.
  const [saveFailed, setSaveFailed] = useState(false); // Meldet fehlgeschlagenes Speichern trotz spielbarer Kolonie.
  const startedRequestId = useRef<string | null>(null); // Verhindert doppelte HTTP-Aufrufe fuer denselben angenommenen Auftrag.
  const loggedEventId = useRef<string | null>(null); // Verhindert doppelte Chronikeintraege bei erneutem Rendern.
  const [activities, setActivities] = useState<Activity[]>(loaded.save.activities); // Stellt auch die Chronik wieder her.

  useLayoutEffect(() => { // Sichert Zustandsaenderungen vor dem sichtbaren Render und vor dem Expeditionsaufruf.
    try { // Browser koennen Schreibzugriff verweigern oder ihr Speicherlimit erreichen.
      window.localStorage.setItem(saveKey, encodeSave({ colony, paused, activities })); // Schreibt alle Daten gemeinsam in einen Eintrag.
      setSaveFailed(false); // Entfernt die Fehlermeldung nach einem erfolgreichen Schreibversuch.
    } catch { // Bei einem Fehler bleibt die aktuelle Sitzung spielbar.
      setSaveFailed(true); // Macht sichtbar, dass der aktuelle Stand nicht gesichert werden konnte.
    } // Schliesst die Fehlerbehandlung ab.
  }, [colony, paused, activities]); // Speichert nur bei Aenderungen an den gespeicherten Daten.

  const foodShortage = colony.foodShortage; // Liest den Stand des Essens-Countdowns.
  const simulationStopped = paused || Boolean(foodShortage && (!foodShortage.acknowledged || foodShortage.daysRemaining === 0)); // Haelt die Uhr bei Pause, Warnung oder Game Over an.

  useEffect(() => {
    if (simulationStopped) return; // Startet nur dann einen Timer, wenn die Kolonie weiterspielen kann.

    const timer = window.setInterval(
      () => setColony((current) => advanceDay(current)),
      8_000,
    );

    return () => window.clearInterval(timer);
  }, [simulationStopped]); // Beginnt nach OK mit einem vollen Spieltag.

  useEffect(() => {
    const event = colony.lastExpeditionEvent;
    if (!event || loggedEventId.current === event.id) return; // Jede bestaetigte Reisemeldung erscheint hoechstens einmal.
    loggedEventId.current = event.id;
    setActivities((current) => current.some((entry) => entry.id === event.id) ? current : [event, ...current].slice(0, 6)); // Die Chronik folgt dem tatsaechlich geaenderten Spielzustand.
  }, [colony.lastExpeditionEvent]);

  useEffect(() => {
    const active = colony.activeExpedition;
    if (!active || startedRequestId.current === active.requestId) return; // Erst ein angenommener Auftrag startet das Netzwerk, nie ein abgewiesener Klick.
    startedRequestId.current = active.requestId;

    void beginExpedition(active.residentId, active.destination) // Das API-Feld heisst weiterhin dwarfId; sein Wert darf auch eine Elfenkennung sein.
      .then((result) => setColony((current) => finishExpeditionSuccess(current, active.requestId, result))) // Nur die noch aktive Kennung darf Beute vergeben.
      .catch((error: unknown) => setColony((current) => finishExpeditionFailure(
        current, active.requestId,
        error instanceof Error ? error.message : "The expedition was lost from view.",
      ))); // Fehler und Zeitlimit geben nur den zugehoerigen Scout wieder frei.
  }, [colony.activeExpedition]);

  function assignResident(id: string, assignment: JobType) {
    const resident = colony.residents.find((item) => item.id === id); // Sucht den Bewohner fuer Aufgabe und Chronik.
    if (!resident || !isAvailable(resident) || !canWork(resident, assignment)) return; // Elfen duerfen weder Holz noch Stein abbauen.
    setColony((current) => ({
      ...current,
      residents: current.residents.map((item) =>
        item.id === id && isAvailable(item) && canWork(item, assignment) // Prueft die Speziesregel auch im aktuellen Zustand.
          ? {
              ...item,
              assignment,
              status: assignment ? "working" : "idle",
            }
          : item,
      ),
    }));

    setActivities((current) =>
      [
        {
          id: crypto.randomUUID(),
          day: colony.day,
          message: `${resident.name} assigned to ${jobLabel(assignment)}.`,
        },
        ...current,
      ].slice(0, 6),
    );
  }

  function equipTool(residentId: string, tool: ToolType) {
    setColony((current) => applyEquipTool(current, residentId, tool)); // Die reine Zustandsfunktion verhindert doppeltes Ausruesten.
  }

  function returnTool(residentId: string) {
    setColony((current) => applyReturnTool(current, residentId)); // Nur ein wirklich getragenes Werkzeug geht zurueck ins Lager.
  }

  function craftItem(residentId: string, item: CraftItem) { // Gibt Schmied und Rezept an die Spielregel weiter.
    setColony((current) => applyCraftItem(current, residentId, item)); // Prueft Bewohner und Materialien gemeinsam im neuesten Zustand.
  } // Schliesst die Aktion der Schmiedeseite ab.

  function sendExpedition(residentId: string, destination: string) {
    const requestId = crypto.randomUUID(); // Ein schneller zweiter Klick erhaelt eine andere Kennung und wird im aktuellen Zustand abgewiesen.
    setColony((current) => startExpedition(current, residentId, destination, requestId)); // Werkzeugrueckgabe und Aufbruch geschehen gemeinsam.
  }

  function restartColony() { // Ersetzt den alten Lauf durch eine frische Kolonie.
    setColony(newGame.colony); // Entfernt Hungerfrist, Schmiedeauftraege und aktive Reise.
    setPaused(newGame.paused); // Startet die Tagesuhr wieder.
    setActivities(newGame.activities); // Beginnt mit einer frischen Chronik.
    setLoadNotice(""); // Entfernt Hinweise aus dem vorherigen Lauf.
  } // Der Speichereffekt schreibt den frischen Zustand in denselben Browser-Eintrag.

  const value: ColonyContextValue = {
    restartColony, // Stellt den Neustart fuer den Game-Over-Knopf bereit.
    saveNotice: [loadNotice, saveFailed ? "Progress could not be saved in this browser." : ""].filter(Boolean).join(" "), // Verbindet Lade- und Schreibhinweise, falls beide vorliegen.
    colony,
    paused: simulationStopped, // Zeigt auch bei der Essenswarnung eine pausierte Simulation an.
    acknowledgeFoodShortage: () => setColony((current) => { // Bestaetigt die Warnung im aktuellen Spielstand.
      const shortage = current.foodShortage; // Liest die noch offene Warnung.
      if (!shortage || shortage.acknowledged) return current; // Ignoriert eine wiederholte Bestaetigung.
      return { ...current, foodShortage: { ...shortage, acknowledged: true } }; // Entsperrt die Uhr und laesst die Frist bestehen.
    }), // Schliesst die Aktion des OK-Knopfs.
    activities,
    expeditionPending: Boolean(colony.activeExpedition), // Die Schaltflaeche und der Scout beziehen sich auf denselben Auftrag.
    togglePaused: () => setPaused((value) => !value),
    assignResident,
    equipTool,
    returnTool,
    craftItem,
    sendExpedition,
  };

  return <ColonyContext value={value}>{children}</ColonyContext>;
}

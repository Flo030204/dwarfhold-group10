import { useEffect, useRef, useState, type ReactNode } from "react";
import { beginExpedition } from "../api";
import { craftItem as applyCraftItem, equipTool as applyEquipTool, returnTool as applyReturnTool, isAvailable } from "../equipment"; // Nutzt dieselbe Verfuegbarkeit wie die Schmiede.
import { finishExpeditionFailure, finishExpeditionSuccess, startExpedition } from "../expedition";
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
  dwarves: [
    {
      id: "dwarf-1",
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
      name: "Dori Ashmantle",
      title: "Stone Singer",
      icon: "🧔🏽",
      assignment: null,
      status: "idle",
      equippedTool: null,
    },
  ],
};

export function ColonyProvider({ children }: { children: ReactNode }) {
  const [colony, setColony] = useState(initialState);
  const [paused, setPaused] = useState(false);
  const startedRequestId = useRef<string | null>(null); // Verhindert doppelte HTTP-Aufrufe fuer denselben angenommenen Auftrag.
  const loggedEventId = useRef<string | null>(null); // Verhindert doppelte Chronikeintraege bei erneutem Rendern.
  const [activities, setActivities] = useState<Activity[]>([
    {
      id: "welcome",
      day: 12,
      message: "The forge fires are lit. Stonehome wakes.",
    },
  ]);

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
    setActivities((current) => [event, ...current].slice(0, 6)); // Die Chronik folgt dem tatsaechlich geaenderten Spielzustand.
  }, [colony.lastExpeditionEvent]);

  useEffect(() => {
    const active = colony.activeExpedition;
    if (!active || startedRequestId.current === active.requestId) return; // Erst ein angenommener Auftrag startet das Netzwerk, nie ein abgewiesener Klick.
    startedRequestId.current = active.requestId;

    void beginExpedition(active.dwarfId, active.destination)
      .then((result) => setColony((current) => finishExpeditionSuccess(current, active.requestId, result))) // Nur die noch aktive Kennung darf Beute vergeben.
      .catch((error: unknown) => setColony((current) => finishExpeditionFailure(
        current, active.requestId,
        error instanceof Error ? error.message : "The expedition was lost from view.",
      ))); // Fehler und Zeitlimit geben nur den zugehoerigen Scout wieder frei.
  }, [colony.activeExpedition]);

  function assignDwarf(id: string, assignment: JobType) {
    const dwarf = colony.dwarves.find((item) => item.id === id); // Sucht den Zwerg fuer Aufgabe und Chronik.
    if (!dwarf || !isAvailable(dwarf)) return; // Beschaeftigte Zwerge koennen ihre Aufgabe nicht wechseln.
    setColony((current) => ({
      ...current,
      dwarves: current.dwarves.map((dwarf) =>
        dwarf.id === id && isAvailable(dwarf) // Prueft die Verfuegbarkeit auch im aktuellen Zustand.
          ? {
              ...dwarf,
              assignment,
              status: assignment ? "working" : "idle",
            }
          : dwarf,
      ),
    }));

    setActivities((current) =>
      [
        {
          id: crypto.randomUUID(),
          day: colony.day,
          message: `${dwarf?.name ?? "A dwarf"} assigned to ${jobLabel(assignment)}.`,
        },
        ...current,
      ].slice(0, 6),
    );
  }

  function equipTool(dwarfId: string, tool: ToolType) {
    setColony((current) => applyEquipTool(current, dwarfId, tool)); // Die reine Zustandsfunktion verhindert doppeltes Ausruesten.
  }

  function returnTool(dwarfId: string) {
    setColony((current) => applyReturnTool(current, dwarfId)); // Nur ein wirklich getragenes Werkzeug geht zurueck ins Lager.
  }

  function craftItem(dwarfId: string, item: CraftItem) { // Gibt Schmied und Rezept an die Spielregel weiter.
    setColony((current) => applyCraftItem(current, dwarfId, item)); // Prueft Zwerg und Materialien gemeinsam im neuesten Zustand.
  } // Schliesst die Aktion der Schmiedeseite ab.

  function sendExpedition(dwarfId: string, destination: string) {
    const requestId = crypto.randomUUID(); // Ein schneller zweiter Klick erhaelt eine andere Kennung und wird im aktuellen Zustand abgewiesen.
    setColony((current) => startExpedition(current, dwarfId, destination, requestId)); // Werkzeugrueckgabe und Aufbruch geschehen gemeinsam.
  }

  const value: ColonyContextValue = {
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
    assignDwarf,
    equipTool,
    returnTool,
    craftItem,
    sendExpedition,
  };

  return <ColonyContext value={value}>{children}</ColonyContext>;
}

import { useEffect, useState, type ReactNode } from "react";
import { beginExpedition } from "../api";
import { craftItem as applyCraftItem, equipTool as applyEquipTool, returnTool as applyReturnTool, isAvailable, toolDetails } from "../equipment"; // Nutzt dieselbe Verfuegbarkeit wie die Schmiede.
import { advanceDay, jobLabel } from "../simulation";
import type {
  Activity,
  ColonyState,
  CraftItem, // Beschreibt die Werkzeugart oder Waffe des Auftrags.
  JobType,
  ResourceKey,
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
  const [expeditionPending, setExpeditionPending] = useState(false);
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

  async function sendExpedition(dwarfId: string, destination: string) {
    const dwarf = colony.dwarves.find((item) => item.id === dwarfId);
    if (!dwarf || !isAvailable(dwarf) || expeditionPending) return; // Verhindert einen weiteren Aufbruch waehrend einer laufenden Expedition.

    setExpeditionPending(true);
    setColony((current) => ({
      ...current,
      dwarves: current.dwarves.map((item) =>
        item.id === dwarf.id && isAvailable(item) ? { ...item, status: "expedition" } : item, // Prueft die Verfuegbarkeit beim Aufbruch erneut.
      ),
    }));
    setActivities((current) => [
      {
        id: crypto.randomUUID(),
        day: colony.day,
        message: `${dwarf.name} departed for ${destination.replace("-", " ")}.`,
      },
      ...current,
    ]);

    try {
      const result = await beginExpedition(dwarf.id, destination);

      setColony((current) => ({
        ...current,
        resources: Object.entries(result.rewards).reduce(
          (all, [key, amount]) => ({
            ...all,
            [key]: all[key as ResourceKey] + (amount ?? 0),
          }),
          current.resources,
        ),
        toolStock: result.toolReward
          ? { ...current.toolStock, [result.toolReward]: current.toolStock[result.toolReward] + 1 } // Die zufaellig geloste Werkzeugart geht einmal ins freie Lager.
          : current.toolStock,
        dwarves: current.dwarves.map((item) =>
          item.id === dwarf.id
            ? {
                ...item,
                status: item.assignment ? "working" : "idle",
              }
            : item,
        ),
      }));
      setActivities((current) =>
        [
          {
            id: result.expeditionId,
            day: colony.day,
            message: result.toolReward ? `${result.message} Found: ${toolDetails[result.toolReward].label}.` : result.message, // Nennt die konkrete Beute in der Chronik.
            tone: "good" as const,
          },
          ...current,
        ].slice(0, 6),
      );
    } catch (error) {
      setColony((current) => ({ // Holt den Zwerg auch bei einem fehlgeschlagenen Auftrag zurueck.
        ...current, // Behaelt den aktuellen Tagesstand und die Vorraete bei.
        dwarves: current.dwarves.map((item) => // Sucht den zurueckkehrenden Zwerg in der Liste.
          item.id === dwarf.id // Aendert den Status nur fuer den betroffenen Zwerg.
            ? { ...item, status: item.assignment ? "working" : "idle" } // Stellt seine bisherige Arbeit oder den Leerlauf wieder her.
            : item, // Andere Zwerge behalten ihren Zustand.
        ), // Schliesst die aktualisierte Zwergliste.
      })); // Speichert die Rueckkehr fuer den naechsten Spieltag.
      setActivities((current) =>
        [
          {
            id: crypto.randomUUID(),
            day: colony.day,
            message:
              error instanceof Error
                ? error.message
                : "The expedition was lost from view.",
            tone: "warning" as const,
          },
          ...current,
        ].slice(0, 6),
      );
    }

    setExpeditionPending(false);
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
    expeditionPending,
    togglePaused: () => setPaused((value) => !value),
    assignDwarf,
    equipTool,
    returnTool,
    craftItem,
    sendExpedition,
  };

  return <ColonyContext value={value}>{children}</ColonyContext>;
}

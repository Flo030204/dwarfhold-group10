import { useEffect, useState, type ReactNode } from "react";
import { beginExpedition } from "../api";
import { advanceDay, jobLabel } from "../simulation";
import type {
  Activity,
  ColonyState,
  JobType,
  ResourceKey,
} from "../types";
import { ColonyContext, type ColonyContextValue } from "./ColonyContext";

const initialState: ColonyState = {
  day: 12,
  resources: {
    wood: 14,
    stone: 9,
    food: 18,
    tools: 1,
  },
  dwarves: [
    {
      id: "dwarf-1",
      name: "Bromli Copperkeg",
      title: "Hold Warden",
      icon: "🧔🏻",
      assignment: "mining",
      status: "working",
      specialty: "mining",
    },
    {
      id: "dwarf-2",
      name: "Yrsa Flintbraid",
      title: "Trail Scout",
      icon: "🧔🏼‍♀️",
      assignment: "woodcutting",
      status: "working",
      specialty: "woodcutting",
    },
    {
      id: "dwarf-3",
      name: "Dori Ashmantle",
      title: "Stone Singer",
      icon: "🧔🏽",
      assignment: null,
      status: "idle",
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
    if (!dwarf || dwarf.status === "expedition") return; // Verhindert eine neue Aufgabe waehrend der Expedition.
    setColony((current) => ({
      ...current,
      dwarves: current.dwarves.map((dwarf) =>
        dwarf.id === id && dwarf.status !== "expedition" // Prueft die Verfuegbarkeit auch im aktuellen Zustand.
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

  function craftTool() {
    if (colony.resources.wood < 3) {
      setActivities((current) => [
        {
          id: crypto.randomUUID(),
          day: colony.day,
          message: "The forge needs more timber.",
          tone: "warning" as const,
        },
        ...current,
      ]);
      return;
    }

    setColony((current) => ({
      ...current,
      resources: {
        ...current.resources,
        wood: current.resources.wood - 3,
        stone: current.resources.stone - 2,
        tools: current.resources.tools + 1,
      },
    }));
    setActivities((current) =>
      [
        {
          id: crypto.randomUUID(),
          day: colony.day,
          message: "A sturdy iron tool joins the stores.",
          tone: "good" as const,
        },
        ...current,
      ].slice(0, 6),
    );
  }

  async function sendExpedition(dwarfId: string, destination: string) {
    const dwarf = colony.dwarves.find((item) => item.id === dwarfId);
    if (!dwarf || dwarf.status === "expedition" || expeditionPending) return; // Verhindert einen weiteren Aufbruch waehrend einer laufenden Expedition.

    setExpeditionPending(true);
    setColony((current) => ({
      ...current,
      dwarves: current.dwarves.map((item) =>
        item.id === dwarf.id ? { ...item, status: "expedition" } : item,
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
            message: result.message,
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
    craftTool,
    sendExpedition,
  };

  return <ColonyContext value={value}>{children}</ColonyContext>;
}

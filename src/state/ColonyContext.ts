import { createContext, useContext } from "react";
import type { Activity, ColonyState, JobType, ToolType } from "../types";
import type { CraftItem } from "../equipment";

export interface ColonyContextValue {
  colony: ColonyState;
  paused: boolean;
  acknowledgeFoodShortage: () => void; // Bestaetigt das Popup und gibt die Tagesuhr wieder frei.
  activities: Activity[];
  expeditionPending: boolean;
  togglePaused: () => void;
  assignDwarf: (id: string, assignment: JobType) => void;
  equipTool: (dwarfId: string, tool: ToolType) => void; // Ruft die Bestandspruefung beim Ausruesten auf.
  returnTool: (dwarfId: string) => void; // Legt das getragene Werkzeug wieder ins Lager.
  craftItem: (item: CraftItem) => void; // Schmiedet eine bestimmte Werkzeugart oder eine Waffe.
  sendExpedition: (dwarfId: string, destination: string) => Promise<void>;
}

export const ColonyContext = createContext<ColonyContextValue | null>(null);

export function useColony(): ColonyContextValue {
  const context = useContext(ColonyContext);
  if (!context) {
    throw new Error("useColony must be used inside <ColonyProvider>");
  }
  return context;
}

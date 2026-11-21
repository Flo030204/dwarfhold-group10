import { createContext, useContext } from "react";
import type { Activity, ColonyState, CraftItem, JobType, ToolType } from "../types"; // Uebernimmt den Rezepttyp aus dem gemeinsamen Spielzustand.

export interface ColonyContextValue {
  colony: ColonyState;
  paused: boolean;
  restartColony: () => void; // Ersetzt den gespeicherten Lauf beim Neustart.
  saveNotice: string; // Meldet, wenn der Browserstand nicht gelesen oder geschrieben werden konnte.
  acknowledgeFoodShortage: () => void; // Bestaetigt das Popup und gibt die Tagesuhr wieder frei.
  activities: Activity[];
  expeditionPending: boolean;
  togglePaused: () => void;
  assignDwarf: (id: string, assignment: JobType) => void;
  equipTool: (dwarfId: string, tool: ToolType) => void; // Ruft die Bestandspruefung beim Ausruesten auf.
  returnTool: (dwarfId: string) => void; // Legt das getragene Werkzeug wieder ins Lager.
  craftItem: (dwarfId: string, item: CraftItem) => void; // Startet das Rezept mit dem ausgewaehlten Zwerg.
  sendExpedition: (dwarfId: string, destination: string) => void; // Der Aufbruch speichert zuerst den Auftrag; die API startet danach.
}

export const ColonyContext = createContext<ColonyContextValue | null>(null);

export function useColony(): ColonyContextValue {
  const context = useContext(ColonyContext);
  if (!context) {
    throw new Error("useColony must be used inside <ColonyProvider>");
  }
  return context;
}

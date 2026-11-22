export type ResourceKey = "wood" | "stone" | "food" | "weapons";
export type JobType = "woodcutting" | "mining" | "farming" | null;
export type ResidentStatus = "idle" | "working" | "expedition" | "crafting"; // Schmieden belegt jeden Bewohner wie eine Expedition.
export type ToolType = "axe" | "pickaxe" | "mushroomSickle";
export type CraftItem = ToolType | "weapon"; // Ein Schmiedeauftrag ergibt eine konkrete Werkzeugart oder eine Waffe.
export type ToolStock = Record<ToolType, number>; // Zaehlt nur Werkzeuge, die noch nicht ausgeruestet sind.
export interface Resources { wood: number; stone: number; food: number; weapons: number }
export type Species = "dwarf" | "elf"; // Bestimmt Produktion, Aussehen und Schmiededauer eines Bewohners.

export interface Resident {
  id: string;
  species: Species; // Trennt die Elfe explizit von den drei Startzwergen.
  name: string;
  title: string;
  icon: string;
  assignment: JobType;
  status: ResidentStatus;
  forgeTask?: { item: CraftItem; completesOnDay: number }; // Merkt sich Produkt und Fertigstellungstag am verantwortlichen Schmied.
  equippedTool: ToolType | null; // Ein Bewohner traegt hoechstens eine konkrete Werkzeugart.
  specialty?: Exclude<JobType, null>;
}

export interface ColonyState { 
    raidPopup?: "attack" | "result"; // Speichert, welche Meldung zum letzten Spinnenangriff noch offen ist.
    foodShortage?: { daysRemaining: number; acknowledged: boolean }; // Speichert die Frist und ob das Popup bestaetigt wurde.
    day: number; 
    resources: Resources; 
    toolStock: ToolStock; // Ausgeruestete Werkzeuge liegen nicht gleichzeitig im Lager.
    activeExpedition?: { requestId: string; residentId: string; destination: string }; // Nur ein angenommener Reiseauftrag darf gleichzeitig laufen.
    lastExpeditionEvent?: Activity; // Haelt die letzte bestaetigte Reisemeldung fuer die Chronik fest.
    residents: Resident[]; // Umfasst Zwerge und die einmalig beitretende Elfe.
}

export interface ExpeditionResult { 
    expeditionId: string; 
    status: "completed"; 
    rewards: Partial<Resources>; 
    toolReward?: ToolType; // Eine erfolgreiche Expedition kann genau eine Werkzeugart liefern.
    message: string 
}

export interface Activity { 
    id: string; 
    day: number; 
    message: string; 
    tone?: "good" | "warning" 
}

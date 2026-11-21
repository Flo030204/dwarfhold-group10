export type ResourceKey = "wood" | "stone" | "food" | "weapons";
export type JobType = "woodcutting" | "mining" | "farming" | null;
export type DwarfStatus = "idle" | "working" | "expedition";
export type ToolType = "axe" | "pickaxe" | "mushroomSickle";
export type ToolStock = Record<ToolType, number>; // Zaehlt nur Werkzeuge, die noch nicht ausgeruestet sind.
export interface Resources { wood: number; stone: number; food: number; weapons: number }

export interface Dwarf { 
    id: string;
     name: string; 
     title: string; 
     icon: string; 
     assignment: JobType; 
     status: DwarfStatus; 
     equippedTool: ToolType | null; // Ein Zwerg traegt hoechstens eine konkrete Werkzeugart.
     specialty?: Exclude<JobType, null> 
}

export interface ColonyState { 
    foodShortage?: { daysRemaining: number; acknowledged: boolean }; // Speichert die Frist und ob das Popup bestaetigt wurde.
    day: number; 
    resources: Resources; 
    toolStock: ToolStock; // Ausgeruestete Werkzeuge liegen nicht gleichzeitig im Lager.
    dwarves: Dwarf[] 
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

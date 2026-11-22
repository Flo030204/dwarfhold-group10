import type { JobType, Resident, Species } from "./types";

export const elfId = "elf-liora"; // Die feste Kennung verhindert einen zweiten Beitritt derselben Figur.

export const elfResident: Resident = {
  id: elfId,
  species: "elf",
  name: "Liora Moonfern",
  title: "Crystal Grove Keeper",
  icon: "🧝‍♀️",
  assignment: "farming",
  status: "working",
  equippedTool: null,
}; // Liora beginnt in ihrer einzigen produktiven Arbeit und verbraucht ab dem naechsten Tag eine Ration.

export function canWork(resident: Resident, job: JobType): boolean {
  return job === null || resident.species === "dwarf" || job === "farming"; // Der Elf erzeugt weder Holz noch Stein.
}

export const forgeDays: Record<Species, number> = { dwarf: 1, elf: 7 }; // Der Elf kann alle Rezepte, braucht dafuer siebenmal so viele Spieltage.

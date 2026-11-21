export const expeditionTools = ["axe", "pickaxe", "mushroomSickle"]; // Die API und das Spiel nutzen dieselben drei Werkzeugnamen.

export function randomTool(random = Math.random) {
  return expeditionTools[Math.floor(random() * expeditionTools.length)]; // Waehlt bei jedem Erfolg gleichverteilt eine der drei Arten.
}

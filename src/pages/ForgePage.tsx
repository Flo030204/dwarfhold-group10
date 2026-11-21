import { useState } from "react"; // Merkt sich den in der Schmiede ausgewaehlten Zwerg.
import { Chronicle } from "../components/Chronicle";
import { craftLabel, isAvailable, toolDetails, toolTypes, weaponRecipe } from "../equipment"; // Teilt Rezepte und Verfuegbarkeit mit der Simulation.
import { useColony } from "../state/ColonyContext";

export function ForgePage() {
  const { colony, activities, craftItem } = useColony();
  const [smithId, setSmithId] = useState(""); // Verlangt eine bewusste Auswahl des Schmieds.
  const smith = colony.dwarves.find((dwarf) => dwarf.id === smithId); // Liest die aktuelle Verfuegbarkeit der Auswahl.
  const canForge = Boolean(smith && isAvailable(smith)); // Sperrt alle Rezepte ohne verfuegbaren Schmied.
  const smithsAtWork = colony.dwarves.filter((dwarf) => dwarf.forgeTask); // Sammelt die laufenden Auftraege fuer die Anzeige.

  return (
    <div className="forge-layout">
      <section className="panel forge">
        <div>
          <small>EMBER FORGE</small>
          <h2>Forge equipment</h2>
          <p>Each tool improves one matching job by one resource per day.</p>
          <p>Forging takes one game day. The smith's regular job pauses until then.</p>{/* Erklaert Dauer und Auswirkung auf die Tagesarbeit. */}
          <label className="forge-smith">
            {/* Die Auswahl bestimmt, welcher Zwerg das Rezept ausfuehrt. */}
            Smith
            <select value={smithId} onChange={(event) => setSmithId(event.target.value)}>
              {/* Ohne Auswahl bleiben die Rezepte gesperrt. */}
              <option value="">Choose a dwarf</option>
              {/* Beschaeftigte Zwerge bleiben sichtbar und sind nicht auswaehlbar. */}
              {colony.dwarves.map((dwarf) => (
                <option key={dwarf.id} value={dwarf.id} disabled={!isAvailable(dwarf)}>
                  {dwarf.name}{!isAvailable(dwarf) ? ` (${dwarf.status})` : ""}{/* Nennt den Grund fuer die Sperre. */}
                </option>
              ))}
            </select>
          </label>
          {/* Die Auftragsliste zeigt bei jedem Besuch den verantwortlichen Zwerg und den Zieltag. */}
          {smithsAtWork.length > 0 && (
            <div className="forge-orders" aria-live="polite">
              <h3>In progress</h3>{/* Markiert die noch nicht ausgelieferten Rezepte. */}
              <ul>
                {smithsAtWork.map(({ id, name, forgeTask }) => forgeTask && (
                  <li key={id}>{name} is forging {craftLabel(forgeTask.item)}. Ready on day {forgeTask.completesOnDay}.</li>
                ))}{/* Jeder Eintrag beschreibt genau einen laufenden Auftrag. */}
              </ul>
            </div>
          )}
        </div>
        <div className="recipe-list">
          {toolTypes.map((tool) => {
            const detail = toolDetails[tool]; // Alle Rezeptkarten verwenden dieselben Kosten wie die Spielaktion.
            return <div className="recipe" key={tool}>
              <span>{detail.icon} {detail.label}</span>
              <span>{detail.cost.wood} 🪵 + {detail.cost.stone} 🪨</span>
              <button disabled={!canForge || colony.resources.wood < detail.cost.wood || colony.resources.stone < detail.cost.stone}
                onClick={() => craftItem(smithId, tool)}>Forge</button>{/* Startet das Werkzeugrezept mit dem gewaehlten Zwerg. */}
            </div>;
          })}
          <div className="recipe">
            <span>🛡️ Weapon</span>
            <span>{weaponRecipe.wood} 🪵 + {weaponRecipe.stone} 🪨</span>
            <button disabled={!canForge || colony.resources.wood < weaponRecipe.wood || colony.resources.stone < weaponRecipe.stone}
              onClick={() => craftItem(smithId, "weapon")}>Forge</button>{/* Startet das Waffenrezept mit dem gewaehlten Zwerg. */}
          </div>{/* Waffen bleiben im gemeinsamen Lager fuer die spaetere Verteidigung. */}
        </div>
      </section>

      <Chronicle activities={activities} />
    </div>
  );
}

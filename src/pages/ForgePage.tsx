import { useState } from "react"; // Merkt sich den in der Schmiede ausgewaehlten Zwerg.
import { Chronicle } from "../components/Chronicle";
import { craftLabel, isAvailable, toolDetails, toolTypes, weaponRecipe } from "../equipment"; // Teilt Rezepte und Verfuegbarkeit mit der Simulation.
import { forgeDays } from "../residents"; // Zeigt dieselben Dauerregeln wie beim Auftragsstart.
import { useColony } from "../state/ColonyContext";

export function ForgePage() {
  const { colony, activities, craftItem } = useColony();
  const [smithId, setSmithId] = useState(""); // Verlangt eine bewusste Auswahl des Schmieds.
  const smith = colony.residents.find((resident) => resident.id === smithId); // Liest die aktuelle Verfuegbarkeit der Auswahl.
  const canForge = Boolean(smith && isAvailable(smith)); // Sperrt alle Rezepte ohne verfuegbaren Schmied.
  const smithsAtWork = colony.residents.filter((resident) => resident.forgeTask); // Sammelt die laufenden Auftraege fuer die Anzeige.

  return (
    <div className="forge-layout">
      <section className="panel forge">
        <div>
          <small>EMBER FORGE</small>
          <h2>Forge equipment</h2>
          <p>Each tool improves one matching job by one resource per day.</p>
          <p>Dwarves forge in one game day; elves need seven. All residents can forge every recipe.</p>{/* Erklaert die beiden Dauerregeln und die freie Rezeptwahl. */}
          {smith && <p>{smith.name} needs {forgeDays[smith.species]} game {forgeDays[smith.species] === 1 ? "day" : "days"} per order. Regular work pauses while forging.</p>}{/* Die Auswahl zeigt die konkrete Wartezeit vor dem Klick. */}
          <p>Forge orders resume after reloading. Materials are paid only when the order starts.</p>{/* Erklaert die Wiederaufnahme des laufenden Auftrags. */}
          <label className="forge-smith">
            {/* Die Auswahl bestimmt, welcher Bewohner das Rezept ausfuehrt. */}
            Smith
            <select value={smithId} onChange={(event) => setSmithId(event.target.value)}>
              {/* Ohne Auswahl bleiben die Rezepte gesperrt. */}
              <option value="">Choose a smith</option>
              {/* Beschaeftigte Zwerge bleiben sichtbar und sind nicht auswaehlbar. */}
              {colony.residents.map((resident) => (
                <option key={resident.id} value={resident.id} disabled={!isAvailable(resident)}>
                  {resident.name}{!isAvailable(resident) ? ` (${resident.status})` : ""}{/* Nennt den Grund fuer die Sperre. */}
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
                  <li key={id}>{name} is forging {craftLabel(forgeTask.item)}. Ready on day {forgeTask.completesOnDay} ({forgeTask.completesOnDay - colony.day} days left).</li>
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

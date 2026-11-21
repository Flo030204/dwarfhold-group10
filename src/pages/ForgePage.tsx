import { Chronicle } from "../components/Chronicle";
import { toolDetails, toolTypes, weaponRecipe } from "../equipment";
import { useColony } from "../state/ColonyContext";

export function ForgePage() {
  const { colony, activities, craftItem } = useColony();

  return (
    <div className="forge-layout">
      <section className="panel forge">
        <div>
          <small>EMBER FORGE</small>
          <h2>Forge equipment</h2>
          <p>Each tool improves one matching job by one resource per day.</p>
        </div>
        <div className="recipe-list">
          {toolTypes.map((tool) => {
            const detail = toolDetails[tool]; // Alle Rezeptkarten verwenden dieselben Kosten wie die Spielaktion.
            return <div className="recipe" key={tool}>
              <span>{detail.icon} {detail.label}</span>
              <span>{detail.cost.wood} 🪵 + {detail.cost.stone} 🪨</span>
              <button disabled={colony.resources.wood < detail.cost.wood || colony.resources.stone < detail.cost.stone}
                onClick={() => craftItem(tool)}>Forge</button>
            </div>;
          })}
          <div className="recipe">
            <span>🛡️ Weapon</span>
            <span>{weaponRecipe.wood} 🪵 + {weaponRecipe.stone} 🪨</span>
            <button disabled={colony.resources.wood < weaponRecipe.wood || colony.resources.stone < weaponRecipe.stone}
              onClick={() => craftItem("weapon")}>Forge</button>
          </div>{/* Waffen bleiben im gemeinsamen Lager fuer die spaetere Verteidigung. */}
        </div>
      </section>

      <Chronicle activities={activities} />
    </div>
  );
}

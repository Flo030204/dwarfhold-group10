import { useState } from "react";
import { Chronicle } from "../components/Chronicle";
import { DwarfRoster } from "../components/DwarfRoster";
import { toolDetails } from "../equipment";
import { dailyResourceChange, jobLabel, production, workingAssignment } from "../simulation"; // Verwendet dieselbe Produktion und Verfuegbarkeit wie der Tageswechsel.
import { useColony } from "../state/ColonyContext";

export function ColonyPage() {
  const {
    colony,
    activities,
    expeditionPending,
    assignDwarf,
    equipTool,
    returnTool,
    sendExpedition,
  } = useColony();
  const [destination, setDestination] = useState("crystal-cave");
  const [expeditionDwarf, setExpeditionDwarf] = useState("dwarf-3");

  const dailyOutput = dailyResourceChange(colony); // Zeigt die tatsaechliche Tagesbilanz an.

  return (
    <div className="dashboard">
      <DwarfRoster dwarves={colony.dwarves} toolStock={colony.toolStock} onAssign={assignDwarf} onEquip={equipTool} onReturn={returnTool} />

      <section className="center-stack">
        <section className="panel production">
          <header>
            <div>
              <small>SHIFT LEDGER</small>
              <h2>Daily Production</h2>
            </div>
            <span>updates each day</span>
          </header>

          <div className="job-grid">
            {(["woodcutting", "mining", "farming"] as const).map((job) => (
              <article key={job}>
                <b>
                  {job === "woodcutting"
                    ? "🌲"
                    : job === "mining"
                      ? "⛏️"
                      : "🍄"}
                </b>
                <h3>{jobLabel(job)}</h3>
                <p>
                  {
                    colony.dwarves.filter(
                      (dwarf) => workingAssignment(dwarf) === job, // Zaehlt nur Zwerge, die diesen Job gerade ausueben.
                    ).length
                  }{" "}
                  assigned
                </p>
                <strong>+{colony.dwarves
                  .filter((dwarf) => workingAssignment(dwarf) === job)
                  .reduce((sum, dwarf) => sum + (Object.values(production[job])[0] ?? 0)
                    + (dwarf.equippedTool && toolDetails[dwarf.equippedTool].job === job ? 1 : 0), 0)} / day</strong>{/* Zeigt den wirklichen Gesamtertrag inklusive passender Werkzeuge. */}
              </article>
            ))}
          </div>

          <div className="net-line">
            <span>NET FOOD AFTER MEALS</span>
            <strong className={dailyOutput.food >= 0 ? "gain" : "loss"}>
              {dailyOutput.food >= 0 ? "+" : ""}
              {dailyOutput.food}
            </strong>
          </div>
        </section>
      </section>

      <aside className="side-stack">
        <section className="panel expedition">
          <header>
            <div>
              <small>BEYOND THE GATE</small>
              <h2>Expedition</h2>
            </div>
            <b>🗺️</b>
          </header>

          <label>
            Scout
            <select
              value={expeditionDwarf}
              onChange={(event) => setExpeditionDwarf(event.target.value)}
            >
              {colony.dwarves.map((dwarf) => (
                <option key={dwarf.id} value={dwarf.id}>
                  {dwarf.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Destination
            <select
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
            >
              <option value="crystal-cave">Crystal Cave</option>
              <option value="old-mine">The Old Mine</option>
              <option value="blocked-pass">Blocked Pass</option>
            </select>
          </label>

          <button
            disabled={expeditionPending}
            onClick={() => sendExpedition(expeditionDwarf, destination)}
          >
            {expeditionPending ? "Beyond the gate…" : "Send expedition"}
          </button>
          <p>
            A result returns in one request. The selected dwarf is unavailable
            while travelling.
          </p>
        </section>

        <Chronicle activities={activities} />
      </aside>
    </div>
  );
}

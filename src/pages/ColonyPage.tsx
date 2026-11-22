import { useState } from "react";
import { Chronicle } from "../components/Chronicle";
import { ResidentRoster } from "../components/ResidentRoster";
import { defenseWeapons, spiderCave, spiderRaid } from "../expedition"; // Zeigt die tatsaechlichen Regeln fuer den Spinnenangriff an.
import { isAvailable } from "../equipment"; // Erkennt, welche Bewohner als Scout aufbrechen koennen.
import { dailyResourceChange, jobLabel, residentProduction, workingAssignment } from "../simulation"; // Zeigt den speziesabhaengigen Ertrag aus derselben Funktion wie die Simulation.
import { useColony } from "../state/ColonyContext";

export function ColonyPage() {
  const {
    colony,
    activities,
    expeditionPending,
    assignResident,
    equipTool,
    returnTool,
    sendExpedition,
  } = useColony();
  const [destination, setDestination] = useState("crystal-cave");
  const [expeditionResident, setExpeditionResident] = useState("dwarf-3");

  const dailyOutput = dailyResourceChange(colony); // Zeigt die tatsaechliche Tagesbilanz an.

  return (
    <div className="dashboard">
      <ResidentRoster residents={colony.residents} toolStock={colony.toolStock} onAssign={assignResident} onEquip={equipTool} onReturn={returnTool} />

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
                    colony.residents.filter(
                      (resident) => workingAssignment(resident) === job, // Zaehlt nur Bewohner, die diesen Job gerade ausueben.
                    ).length
                  }{" "}
                  assigned
                </p>
                <strong>+{colony.residents
                  .filter((resident) => workingAssignment(resident) === job)
                  .reduce((sum, resident) => sum + (Object.values(residentProduction(resident))[0] ?? 0), 0)} / day</strong>{/* Bezieht den Elfenbonus und passende Werkzeuge aus der gemeinsamen Produktionsregel. */}
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
              value={expeditionResident}
              onChange={(event) => setExpeditionResident(event.target.value)}
            >
              {colony.residents.map((resident) => (
                <option key={resident.id} value={resident.id} disabled={!isAvailable(resident)}>
                  {resident.name}{!isAvailable(resident) ? ` (${resident.status})` : ""}{/* Zeigt den Grund, wenn ein Bewohner nicht aufbrechen kann. */}
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
              <option value={spiderCave}>Spider Cave</option>{/* Macht die gefaehrliche Hoehle als eigenes Reiseziel auswaehlbar. */}
              <option value="blocked-pass">Blocked Pass</option>
            </select>
          </label>

          {destination === spiderCave && <p className="loss">A successful trip brings spiders back to Stonehome. Defending consumes {defenseWeapons} weapons. With fewer weapons, you use up all your weapons and lose all expedition loot plus up to {spiderRaid.food} rations, {spiderRaid.stone} stone and {spiderRaid.wood} timber from storage.</p>}{/* Warnt vor der Reise vor Waffenverbrauch und moeglichen Verlusten. */}
          <button
            disabled={expeditionPending || !colony.residents.some((resident) => resident.id === expeditionResident && isAvailable(resident))} // Sperrt den Aufbruch auch dann, wenn der gewaehlte Bewohner schmiedet.
            onClick={() => sendExpedition(expeditionResident, destination)}
          >
            {expeditionPending ? "Beyond the gate…" : "Send expedition"}
          </button>
          <p role="status">
            {colony.activeExpedition
              ? `${colony.residents.find((resident) => resident.id === colony.activeExpedition?.residentId)?.name ?? "The scout"} is travelling to ${colony.activeExpedition.destination.replaceAll("-", " ")}. Returns on day ${colony.activeExpedition.returnsOnDay}${colony.activeExpedition.outcome ? ". Report received." : ". Awaiting report."}`
              : "The scout returns any equipped tool to storage before leaving."}
          </p>{/* Reisetag und API-Status erklaeren, warum ein Scout noch nicht zurueck ist. */}
          <p>Travel takes one game day. Pausing stops the return day, just like forging. Returning scouts remain unequipped.</p>{/* Die Pause gilt fuer Reise und Schmiede gleichermassen. */}
          <p>Reloading resumes the expedition. A report already received remains saved.</p>{/* Erklaert die neue Wiederaufnahme statt eines Abbruchs. */}
        </section>

        <Chronicle activities={activities} />
      </aside>
    </div>
  );
}

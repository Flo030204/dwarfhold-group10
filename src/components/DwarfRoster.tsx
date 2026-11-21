import { jobLabel } from "../simulation";
import { isAvailable, toolDetails, toolTypes } from "../equipment"; // Nutzt fuer Aufgaben und Werkzeug dieselbe Verfuegbarkeit wie die Schmiede.
import type { Dwarf, JobType, ToolStock, ToolType } from "../types";

const jobs: Exclude<JobType, null>[] = [
  "woodcutting",
  "mining",
  "farming",
];

interface Props {
  dwarves: Dwarf[];
  toolStock: ToolStock;
  onAssign: (id: string, job: JobType) => void;
  onEquip: (id: string, tool: ToolType) => void;
  onReturn: (id: string) => void;
}

export function DwarfRoster({ dwarves, toolStock, onAssign, onEquip, onReturn }: Props) {
  const presentDwarves = dwarves.filter(
    (dwarf) => dwarf.status !== "expedition",
  ).length;

  return (
    <section className="panel roster">
      <header>
        <div>
          <small>THE COMPANY</small>
          <h2>Holdfolk</h2>
        </div>
        <span>
          {presentDwarves} / {dwarves.length} present
        </span>
      </header>

      <div className="dwarf-list">
        {dwarves.map((dwarf) => {
          const isAway = dwarf.status === "expedition";
          const specialty = dwarf.specialty
            ? `Skilled in ${jobLabel(dwarf.specialty)}`
            : "Generalist";

          return (
            <article
              className={isAway ? "dwarf away" : "dwarf"}
              key={dwarf.id}
            >
              <div className="portrait">
                {dwarf.icon}
                <i className={dwarf.status} />
              </div>

              <div className="dwarf-details">
                <h3>{dwarf.name}</h3>
                <p>
                  {dwarf.title} · {specialty}
                </p>

                <select
                  value={dwarf.assignment ?? ""}
                  disabled={!isAvailable(dwarf)} // Verhindert Aenderungen waehrend einer Expedition oder eines Schmiedeauftrags.
                  onChange={(event) =>
                    onAssign(
                      dwarf.id,
                      (event.target.value || null) as JobType,
                    )
                  }
                >
                  <option value="">Unassigned</option>
                  {jobs.map((job) => (
                    <option value={job} key={job}>
                      {jobLabel(job)}
                    </option>
                  ))}
                </select>
                <label className="tool-control">
                  Tool
                  <select
                    aria-label={`${dwarf.name} tool`}
                    value={dwarf.equippedTool ?? ""}
                    disabled={!isAvailable(dwarf)} // Verhindert Aenderungen waehrend einer Expedition oder eines Schmiedeauftrags.
                    onChange={(event) => event.target.value
                      ? onEquip(dwarf.id, event.target.value as ToolType)
                      : onReturn(dwarf.id)} // Ein leerer Wert legt das Werkzeug zurueck.
                  >
                    <option value="">No tool</option>
                    {toolTypes.map((tool) => (
                      <option key={tool} value={tool} disabled={toolStock[tool] === 0 && dwarf.equippedTool !== tool}>
                        {toolDetails[tool].label} ({toolStock[tool]} free)
                      </option>
                    ))}
                  </select>
                </label>
                {dwarf.equippedTool && (
                  <p className="tool-effect">
                    {dwarf.status === "working" && dwarf.assignment === toolDetails[dwarf.equippedTool].job
                      ? `+1 ${jobLabel(dwarf.assignment)} output per day`
                      : `No bonus: ${toolDetails[dwarf.equippedTool].label} helps ${jobLabel(toolDetails[dwarf.equippedTool].job)}`}
                  </p>
                )}{/* Die Wirkung eines passenden oder unpassenden Werkzeugs bleibt sichtbar. */}
              </div>

              <span className="status">{dwarf.status}</span>
            </article>
          );
        })}
      </div>
    </section>
  );
}

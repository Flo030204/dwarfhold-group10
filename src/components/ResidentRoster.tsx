import { jobLabel } from "../simulation";
import { isAvailable, toolDetails, toolTypes } from "../equipment"; // Nutzt fuer Aufgaben und Werkzeug dieselbe Verfuegbarkeit wie die Schmiede.
import { canWork, forgeDays } from "../residents"; // Teilt Arbeitsverbote und Schmiededauer mit den Spielregeln.
import type { Resident, JobType, ToolStock, ToolType } from "../types";

const jobs: Exclude<JobType, null>[] = [
  "woodcutting",
  "mining",
  "farming",
];

interface Props {
  residents: Resident[];
  toolStock: ToolStock;
  onAssign: (id: string, job: JobType) => void;
  onEquip: (id: string, tool: ToolType) => void;
  onReturn: (id: string) => void;
}

export function ResidentRoster({ residents, toolStock, onAssign, onEquip, onReturn }: Props) {
  const presentResidents = residents.filter(
    (resident) => resident.status !== "expedition",
  ).length;

  return (
    <section className="panel roster">
      <header>
        <div>
          <small>THE COMPANY</small>
          <h2>Holdfolk</h2>
        </div>
        <span>
          {presentResidents} / {residents.length} present
        </span>
      </header>

      <div className="dwarf-list">
        {residents.map((resident) => {
          const isAway = resident.status === "expedition";
          const specialty = resident.species === "elf"
            ? "8 food/day · 0 wood · 0 stone"
            : resident.specialty ? `Skilled in ${jobLabel(resident.specialty)}` : "Generalist"; // Nennt den konkreten Ertrag der Elfe schon im Register.

          return (
            <article
              className={`dwarf${resident.species === "elf" ? " elf" : ""}${isAway ? " away" : ""}`} // Die Elfe erhaelt einen eigenstaendigen Gruenton.
              key={resident.id}
            >
              <div className="portrait">
                {resident.icon}
                <i className={resident.status} />
              </div>

              <div className="dwarf-details">
                <h3>{resident.name} {resident.species === "elf" && <span className="species-badge">ELF</span>}</h3>{/* Textkennzeichnung macht die Spezies auch ohne Farbwahrnehmung erkennbar. */}
                <p>
                  {resident.title} · {specialty}
                </p>

                <select
                  value={resident.assignment ?? ""}
                  disabled={!isAvailable(resident)} // Verhindert Aenderungen waehrend einer Expedition oder eines Schmiedeauftrags.
                  onChange={(event) =>
                    onAssign(
                      resident.id,
                      (event.target.value || null) as JobType,
                    )
                  }
                >
                  <option value="">Unassigned</option>
                  {jobs.map((job) => (
                    <option value={job} key={job} disabled={!canWork(resident, job)}>{/* Holz und Stein bleiben fuer die Elfe sichtbar, aber nicht waehlbar. */}
                      {jobLabel(job)}
                    </option>
                  ))}
                </select>
                <label className="tool-control">
                  Tool
                  <select
                    aria-label={`${resident.name} tool`}
                    value={resident.equippedTool ?? ""}
                    disabled={!isAvailable(resident)} // Verhindert Aenderungen waehrend einer Expedition oder eines Schmiedeauftrags.
                    onChange={(event) => event.target.value
                      ? onEquip(resident.id, event.target.value as ToolType)
                      : onReturn(resident.id)} // Ein leerer Wert legt das Werkzeug zurueck.
                  >
                    <option value="">No tool</option>
                    {toolTypes.map((tool) => (
                      <option key={tool} value={tool} disabled={toolStock[tool] === 0 && resident.equippedTool !== tool}>
                        {toolDetails[tool].label} ({toolStock[tool]} free)
                      </option>
                    ))}
                  </select>
                </label>
                {resident.equippedTool && (
                  <p className="tool-effect">
                    {resident.status === "working" && canWork(resident, resident.assignment) && resident.assignment === toolDetails[resident.equippedTool].job
                      ? `+1 ${jobLabel(resident.assignment)} output per day`
                      : `No bonus: ${toolDetails[resident.equippedTool].label} helps ${jobLabel(toolDetails[resident.equippedTool].job)}`}
                  </p>
                )}{/* Die Wirkung eines passenden oder unpassenden Werkzeugs bleibt sichtbar. */}
                {resident.species === "elf" && <p className="elf-rule">All recipes · {forgeDays.elf} days to forge</p>}{/* Zeigt die laengere Dauer direkt am Charakter. */}
              </div>

              <span className="status">{resident.status}</span>
            </article>
          );
        })}
      </div>
    </section>
  );
}

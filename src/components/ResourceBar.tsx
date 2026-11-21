import { toolDetails, toolTypes } from "../equipment";
import type { Resources, ToolStock } from "../types";

const details = {
  wood: ["🪵", "Timber"],
  stone: ["🪨", "Stone"],
  food: ["🍄", "Rations"],
  weapons: ["🛡️", "Weapons"],
} as const;

export function ResourceBar({ resources, toolStock }: { resources: Resources; toolStock: ToolStock }) {
  return (
    <section className="resource-bar">
      {Object.entries(resources).map(([key, value]) => {
        const [icon, label] = details[key as keyof Resources];

        return (
          <article key={key}>
            <span>{icon}</span>
            <div>
              <small>{label}</small>
              <strong>{value}</strong>
            </div>
          </article>
        );
      })}
      {toolTypes.map((tool) => (
        <article key={tool}>
          <span>{toolDetails[tool].icon}</span>
          <div>
            <small>{toolDetails[tool].label}</small>{/* Zeigt jede freie Werkzeugart einzeln an. */}
            <strong>{toolStock[tool]}</strong>
          </div>
        </article>
      ))}
    </section>
  );
}

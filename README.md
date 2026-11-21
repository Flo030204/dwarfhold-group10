# Dwarfhold

Dwarfhold is a small browser-based colony and resource-management game. You are the warden of **Stonehome**, a new settlement beneath Emberpeak. Your three dwarves gather supplies, eat from the shared food stores, forge equipment, and explore locations beyond the hold.

This is a partially completed starter for the Advanced Web Development practical exam. It is already playable, but it is not yet a finished game. Investigate its existing behavior and extend it according to the [Requirements](REQUIREMENTS.md).

## How the game works

The colony advances in **days**. One day passes every eight seconds while the simulation is active. The Pause button stops this clock.

Each dwarf can have one of these local assignments:

| Assignment | Production per day |
|---|---:|
| Woodcutting | 3 wood |
| Deep Mining | 2 stone |
| Mushroom Farm | 4 food |
| Unassigned | No production |

At the end of each day, the colony consumes one food for every dwarf. With the initial company of three dwarves, daily meals therefore consume three food. The Shift Ledger shows current assignments and expected production.

Use the assignment dropdown beside a dwarf to change their work. A changed assignment affects subsequent simulation days.

### Resources

The shared inventory contains:

- **Wood**, gathered by woodcutters.
- **Stone**, gathered by miners.
- **Food**, gathered by farmers and consumed by the company.
- **Axes**, **pickaxes**, and **mushroom sickles**, crafted or discovered on expeditions. The stock display counts only unequipped tools.
- **Weapons**, crafted at the forge and stored for future defense.

Each dwarf can carry one tool. An axe adds one wood per day while woodcutting, a pickaxe adds one stone per day while mining, and a mushroom sickle adds one food per day while farming. A tool used for a different job gives no bonus. Before an expedition, the scout returns any equipped tool to the shared stock and comes back unequipped. Tools have no durability rule.

### Ember Forge

The forge offers these recipes:

```text
3 wood + 2 stone -> 1 axe
2 wood + 3 stone -> 1 pickaxe
2 wood + 1 stone -> 1 mushroom sickle
2 wood + 4 stone -> 1 weapon
```

Open the **Forge** page, choose a recipe and an available dwarf. The materials are deducted when the task begins, and the item enters the shared inventory at the next day change. The dwarf cannot work locally or travel while crafting.

### Expeditions

The expedition panel lets you select an available dwarf and one destination. Sending an expedition returns any equipped tool to storage, then starts an asynchronous request to the local API. The dwarf is unavailable while travelling and returns without a tool. A successful result adds the destination's rewards once; a failed or timed-out request returns the dwarf without rewards. Only one expedition runs at a time. Travel continues while the day timer is paused.

The starter destinations:

| Destination | Current outcome |
|---|---|
| Crystal Cave | 8 stone and one randomly selected axe, pickaxe, or mushroom sickle |
| The Old Mine | 12 stone and 2 wood |
| Blocked Pass | A predictable failed expedition |

The short delay is deliberate, so that expedition behavior provides a realistic place to reason about promises, loading state, failures, and consistency between worker and resource state.

## Current starter features

- Three named dwarves with assignments, status, and optional specialization.
- Woodcutting, mining, and farming jobs.
- An automatic eight-second simulation tick with pause/resume.
- Shared wood, stone, food, weapon, and typed tool inventories.
- Daily food consumption.
- Four forge recipes and a job-specific +1 production bonus for equipped tools.
- Separate colony and forge routes sharing the same running simulation.
- A delayed local expedition API with success and failure outcomes.
- A recent-activity chronicle.
- Responsive fantasy-themed React interface.
- A small Vitest suite for pure simulation behavior.

## Run locally

Requirements: Node.js 20.19+ or 22.12+ and npm.

```bash
npm install
npm run dev
```

The web app runs at `http://localhost:5174`; its API runs at `http://localhost:4200`. Available scripts are `dev`, `server`, `build`, `test`, and `preview`.

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Vite frontend and Express API together |
| `npm run server` | Start only the API on port 4200 |
| `npm run build` | Type-check and create a production frontend build |
| `npm run test` | Run the existing Vitest tests once |
| `npm run preview` | Preview a previously created production build |

## API

- `GET /api/health`
- `POST /api/expeditions` with `{ "dwarfId": "dwarf-2", "destination": "crystal-cave" }`

Destinations `crystal-cave` and `old-mine` have rewards. The Crystal Cave tool type is random on each success. `blocked-pass` is the predictable failure case. Add `?fail=true` to force failure or `?latency=2500` to control delay. The default delay is two seconds.

## Project orientation

- `src/App.tsx` defines the colony and forge routes.
- `src/state/ColonyProvider.tsx` owns shared colony state, the simulation timer, and game actions.
- `src/state/ColonyContext.ts` exposes the shared state through `useColony`.
- `src/pages/` contains the shared layout, colony page, and forge page.
- `src/simulation.ts` contains the production table and daily simulation transition.
- `src/equipment.ts` contains tool compatibility, recipes, and inventory-safe equipment actions.
- `src/expedition.ts` contains the checked departure, success, and failure transitions.
- `src/types.ts` defines workers, jobs, statuses, resources, and activity records.
- `src/api.ts` contains the expedition HTTP request.
- `src/components/` contains the roster, resource display, and shared chronicle.
- `server/index.js` implements the local expedition service.


See [docs/API.md](docs/API.md) for contract details.

# Expedition API

`POST /api/expeditions` accepts JSON containing string `dwarfId` and `destination`. A successful response contains an expedition id, `completed` status, a partial resource reward, and a narrative message. A successful `crystal-cave` expedition also returns `toolReward`: one randomly chosen `axe`, `pickaxe`, or `mushroomSickle`. The choice happens once for that response. Invalid input returns 400, an unknown destination returns 404, and `blocked-pass` or `?fail=true` returns 503.

The resource rewards are fixed, while the Crystal Cave tool type is random. Results arrive after a configurable delay; there is no polling or server-side persisted task. Restarting the server resets expedition numbering. During Vite development, `/api` is proxied to port 4200.

The browser checks every successful JSON response before changing the colony. Unknown resource names, invalid amounts, and unknown tool types fail the expedition without rewards. The browser aborts requests that have not completed after ten seconds; a late answer cannot apply rewards after its local expedition has ended. The scout returns any equipped tool to the colony stock before departure and remains unequipped afterward.

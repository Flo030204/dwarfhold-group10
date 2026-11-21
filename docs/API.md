# Expedition API

`POST /api/expeditions` accepts JSON containing string `dwarfId` and `destination`. A successful response contains an expedition id, `completed` status, a partial resource reward, and a narrative message. A successful `crystal-cave` expedition also returns `toolReward`: one randomly chosen `axe`, `pickaxe`, or `mushroomSickle`. The choice happens once for that response. Invalid input returns 400, an unknown destination returns 404, and `blocked-pass` or `?fail=true` returns 503.

The resource rewards are fixed, while the Crystal Cave tool type is random. Results arrive after a configurable delay; there is no polling or server-side persisted task. Restarting the server resets expedition numbering. During Vite development, `/api` is proxied to port 4200.

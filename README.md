# Gamified

A real-time gamification layer for an existing weekly video podcast (six rotating
guests, one host, one producer running OBS). The project does **not** replace the
existing OBS + VDO.Ninja setup — it adds a thin static layer on top of it: a
**guest wrapper page** that iframes VDO.Ninja and surrounds it with reaction
buttons and cards, a **transparent OBS overlay** that animates emojis and card
effects on top of the producer's existing scenes, and a **producer panel** for
roster names, card resets, and tile calibration. No backend server — real-time
events ride VDO.Ninja's existing P2P data channels (`sendData`). Hosted as a
static site on Cloudflare Pages.

See [`CLAUDE.md`](./CLAUDE.md) for architecture rules and [`_planning/build-spec.md`](./_planning/build-spec.md)
for the full build specification.

## Scripts

```
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build
npm run preview    # serve the production build
```

## Routes

| Route | Purpose |
| --- | --- |
| `/play` | Guest/host wrapper around the VDO.Ninja iframe + reaction panel |
| `/overlay` | Transparent OBS browser source that renders emoji + card animations |
| `/producer` | Dockable producer panel: roster names, reset cards, calibration |

## Branches

- `main` — production
- `staging` — pre-production validation
- feature branches → automatic preview URLs

Open PRs against `staging`.

## Show day setup

Production lives at `https://<your-project>.pages.dev`. The producer holds a
short bookmark list for the day: six guest URLs, one host URL, one OBS browser
source URL, one producer dock URL. Build them once per push-ID rotation.

### Guest URLs (one per seat)

```
https://<your-project>.pages.dev/play?seat=<1-6>&push=<pushID>&label=<Guest1-6>
```

- `seat=1..6` maps to tiles `L1, L2, L3, R1, R2, R3` (top-left, middle-left,
  bottom-left, top-right, middle-right, bottom-right).
- `push` is the guest's existing VDO.Ninja stream id — the same one already in
  rotation today (e.g. `i2zCGkA`). The wrapper iframes their existing publish
  URL; it does **not** create a new peer connection.
- `label` is what shows up in the wrapper's right-panel header and in VDO.Ninja's
  built-in chat. Match the rotation roster (`Guest1`..`Guest6`).

Send each guest the URL for their seat. They open it in a desktop browser and
their existing publish setup carries over.

### Host URL

```
https://<your-project>.pages.dev/play?role=host&push=Host1&label=Host
```

Host wrapper is identical to a guest's, except the iframe URL also adds
`&view=TBSqrdw` so the host receives the producer's composited Virtual Camera
feed. The host is excluded from every guest's card target picker — guests can't
card-target the host.

### OBS browser source — `/overlay`

Add a new **Browser Source** in OBS pointing at:

```
https://<your-project>.pages.dev/overlay
```

- **Width / Height:** `1920` × `1080`
- **Custom CSS:** leave empty (the route already sets the body background to
  transparent via `body.overlay-route`).
- **Shutdown source when not visible:** OFF (the data-channel iframe must stay
  mounted for the WebRTC connection to persist).

Per the architecture rule in `CLAUDE.md`, this overlay lives in a dedicated
**`_Overlay` scene** added as a *nested scene source* on top of every other
scene. One peer connection, one render context, no scene-switch reconnects.

For tile calibration during setup, append `?calibrate=1` to the URL — color-
coded dashed rectangles will mark each guest tile so you can edit coordinates
from the producer panel and see them update live.

### Producer panel — Custom Browser Dock

In OBS: **View → Docks → Custom Browser Docks…**, add a new dock with URL:

```
https://<your-project>.pages.dev/producer
```

The panel ships four sections:

1. **Roster names** — set Guest 1..6 names; Save broadcasts to every wrapper
   so target pickers show real names.
2. **Reset cards** — clears per-card use counters across every wrapper between
   topics.
3. **Calibration** — enable the coordinate editors and adjust X/Y/W/H per
   tile; broadcasts live to the overlay.
4. **Activity feed** — last 20 events on the data channel, for spot-checking
   the connection during the show.

The dock is also viewable as a regular browser tab — useful when running OBS
on a different machine than the producer's panel.

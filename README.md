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

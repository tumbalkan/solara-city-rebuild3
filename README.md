[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/tumbalkan/solara-city-rebuild3/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/tumbalkan/solara-city-rebuild3/reward.svg)](https://make.fun/bounty/gta6-01)

# Solara City

An original open-world crime game in the spirit of GTA 6 — built from scratch in three.js, fully offline, no borrowed assets. Every building, car and character is assembled in code from primitives.

Rico Vega rolls into Solara City with a busted sedan and a reputation for driving anything, anywhere. Fixer **Mara** runs the boardwalk cafe — and she has five jobs that pay. Steal cars, dodge the heat, and take the pier back from the gang that thinks it owns the bay.

## The city

- **Four districts on a 7×7 street grid:** a glass downtown of 10–18 storey towers (helipad on the tallest), brick apartments with staggered balconies, shophouses with awnings and sign boards, and a residential quarter of pitched-roof houses with yards — plus a park with a pond.
- **A living beachfront:** boardwalk, sand, umbrellas, a lifeguard tower, a wooden pier on posts, boats bobbing in the bay, palms, drifting clouds and birds overhead.
- **Streets that work:** crosswalks, center dashes, cycling traffic lights, street lamps, hydrants, benches, a bus stop, street signs and parked cars.

## The people

- **Rico Vega** is a fully articulated low-poly character — head with styled hair and sunglasses, jacket over shirt, belt, swinging arms, a procedural walk cycle with hip/knee joints, and a visible pistol when armed.
- **26 pedestrians** with varied skin tones, clothes, hats and heights; some carry bags, some walk dogs. Gunfire sends them running with their arms up.
- **6 distinct car types** — hatchback, sedan, SUV, pickup, sports car, van — each built from parts: spinning wheels with hubcaps, steering front wheels, glass, bumpers, mirrors, plates, glowing headlights and brake lights. Police interceptors wear black-and-white livery with a flashing red/blue light bar.

## The game

- **5 story missions** for Mara: *First Wheels* (steal and deliver a Falcon GT), *The Package* (timed delivery), *Heat Wave* (survive 3 stars), *The Getaway* (lose the tail), *Bayfront Showdown* (clear the pier gang).
- **1–5 star wanted system** with chasing, ramming interceptors and heat that cools when you break line of sight.
- **Combat:** hitscan pistol with muzzle flash and tracers, melee, reload, and five armed gang enemies who shoot back.
- **Traffic:** 14 AI cars on the road graph that keep right, stop at red lights and slow for the car ahead.
- **HUD:** circular minimap (roads, buildings, pulsing objective, flashing police blips), gradient health bar, cash, ammo, wanted stars, speedometer, subtitles and toasts.
- **Audio:** fully synthesized Web Audio — engine hum, two-tone sirens, gunshots, UI chimes. No audio files.
- **Save:** cash and finished missions persist in localStorage.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move / drive |
| Mouse | Look around |
| Shift | Sprint |
| Left click | Shoot |
| Right click | Aim |
| E | Enter / exit car |
| R / F | Reload / melee |
| Space | Brake |
| M / P | Mute / pause |

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

Screenshot staging: `?shot=skyline|rico|drive|chase` (with `&seed=7`).

## Entry

- Competition: [gta6-01](https://make.fun/bounty/gta6-01) on make.fun
- Program: `main.ts` copies `game/` + `screenshots/` to `/output` and writes `dossier.json`
- Engine: three.js 0.160.0, vendored as a single self-contained file under `game/vendor/`
- License: MIT

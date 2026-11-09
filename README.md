# THE BACKROOMS

A first-person backrooms horror game that runs in the browser. No build step, no dependencies, no external assets — every texture, sprite and sound is generated at runtime.

**[Play it here](https://venulousThyDuckulous.github.io/the-backrooms/)**

## The game

You noclipped out of reality. Each level is a freshly generated maze of damp rooms and corridors. Find every carton of **almond water** to unlock the exit door, then get to it.

There are four levels between you and daylight:

| Level | Name           | Mood                                    |
| ----- | -------------- | --------------------------------------- |
| 0     | The Lobby      | Yellow wallpaper, damp carpet, humming  |
| 1     | Habitable Zone | Concrete, pipes, no natural light        |
| 2     | The Poolrooms  | Endless tile and warm standing water     |
| 3     | The Hive       | Red walls. It knows your name.           |

Something else is down there. It freezes while you look straight at it — but staring too long makes it lunge. Sprinting carries through the corridors, and it hears you.

## Controls

| Action       | Keyboard / Mouse       | Touch                        |
| ------------ | ---------------------- | ---------------------------- |
| Move         | `W A S D` / arrow keys | Left stick                   |
| Look         | Mouse (click to lock)  | Drag the right pad           |
| Run          | `Shift`                | `RUN` button                 |
| Flashlight   | `F`                    | `LIGHT` button               |
| Pause        | `Esc`                  | `II` button                  |
| Mute         | `M`                    | Options → Mute audio         |

Mouse sensitivity, volume, render quality and a reduced-flashing mode live in **Options** on the title screen.

## Running locally

It is a static site. Serve the folder over HTTP (ES modules will not load from `file://`):

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## How it works

- **Raycasting renderer** (`js/renderer.js`) — DDA wall casting, per-pixel floor and ceiling casting, billboarded sprites with a depth buffer, distance fog and a flashlight cone, all drawn into a low-resolution `ImageData` buffer that is upscaled with nearest-neighbour filtering.
- **Procedural levels** (`js/world.js`) — seeded drunkard's-walk corridors, carved rooms with pillars, flood-filled reachability, BFS distance fields for prop placement and entity pathing.
- **Procedural art** (`js/textures.js`, `js/sprites.js`) — wallpaper, carpet, concrete, tile and organic wall textures plus the almond water, exit door and the smiling thing, all painted into canvases at load time.
- **Synthesised audio** (`js/audio.js`) — Web Audio oscillators and filtered noise for the fluorescent hum, footsteps, heartbeat, growl, whispers and stingers.
- **Game logic** (`js/game.js`) — movement and collision, stamina, fear, the stalker's gaze/lunge behaviour, pickups, progression, and the death sequence.

Settings and your deepest level are stored in `localStorage`.

## Hosting

Published with GitHub Pages from the root of the `main` branch. There is no build step: push the files and it updates.

## Content note

Contains flashing lights, sudden loud sounds and sustained stalking. Not recommended for photosensitive players.

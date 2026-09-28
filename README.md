# SpinSplit — Team Generator

A responsive, static HTML/CSS/JavaScript website for randomly assigning members to balanced groups using a large, colorful, glowing spinning wheel with polished animations and a mobile-friendly layout.

## Run

Double-click `index.html` in your browser. No installation, build step, login, API key, or server required. The site works offline; if you're offline, it falls back to your browser's system fonts.

## Use

1. Click **Let's get spinning** and enter your total number of members (2–150).
2. Enter their names. You can also paste a newline-separated list into any name field.
3. Enter the number of groups (minimum 2, maximum the number of members) and optionally rename each group. The Build my wheel button stays disabled for 0 or 1 group.
4. Click **SPIN THE WHEEL** once per round. Each round automatically spins once for each group, selecting a different random member per group. For 10 members / 2 groups, there are 5 clicks / rounds and 10 animated name selections in total.
5. Once everyone has been assigned, the page scrolls to the final results. Copy the group results or download a PNG image.

Groups differ by at most one member. Each person is assigned only once. For teams larger than 10, the wheel displays a fresh random sample of up to 10 *remaining* names per spin to keep the labels readable; everyone in the remaining pool still has the same chance of being chosen.

## Files

- `index.html` — markup and interface
- `styles.css` — colors, layout, animations, responsive design
- `script.js` — forms, random selection, spin animations, group assignment, result copy

You can change the colors in the `palette` array in `script.js` and the CSS variables at the top of `styles.css`.

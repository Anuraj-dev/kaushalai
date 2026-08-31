Method: dual-agent (A: Pascal · B: Hypatia)

# Impeccable UX critique

Scope: current homepage and shared app shell, reviewed at desktop and 390px mobile widths. Automated detector: 0 findings.

| Issue | Fix |
|---|---|
| **P1 · Global scaling breaks the layout.** `body` uses `transform: scale(1.5)` and `width: 66.666%` (`src/app/globals.css:34`). The live browser shows blurry text and administrator links/actions extending beyond the desktop viewport. | Remove the transform and width compensation. Use the documented max-width and padding with normal layout CSS. |
| **P1 · Feature cards clip on mobile.** At 390px, the stacked feature cards extend past the right edge (`src/app/globals.css:139,361`; `src/app/page.tsx:55-57`). | Set the mobile grid and cards to `minmax(0, 1fr)` / `min-width: 0`, then verify the full page at 390px. |
| **P1 · The main mobile actions arrive too late.** The hero actions begin around y=1011 at 390×844, after a five-line headline, long lede, and tags. | Move the primary CTA directly below the lede, shorten the hero spacing, and keep the first action visible in the opening viewport. |
| **P1 · The evidence loop is described but not demonstrated.** The homepage shows generic values such as “Version 1” and “Every answer,” without a real role, score, gap, or course recommendation (`src/app/page.tsx:39-42`). | Add one authentic seeded Statistical Investigator result preview with requirement, evidence, confidence, gap, and linked course. |
| **P2 · The two-workspace model is hidden in navigation.** The shared nav exposes only “Start assessment”; `/admin` appears in page CTAs and the footer (`src/components/ui/app-navigation.tsx:6-18`). | Add compact “Official workspace” and “Administrator workspace” links to the shared nav with consistent labels. |
| **P2 · Decorative workflow elements look interactive.** Tags, diagram nodes, and mini charts are visual spans/divs, often `aria-hidden`, but resemble controls (`src/app/page.tsx:17-25,55-57`). | Make meaningful stages links, or label the visuals as illustrative and remove control-like affordances. |

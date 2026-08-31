# Kaushal AI design system

<!-- impeccable:design-schema 1 -->

## Source and fidelity boundary

This system adapts the supplied Frame landing-page reference to Kaushal AI. The reference is a 1920 × 14,931 desktop screenshot with a centered white page, an outer light-gray canvas, near-black typography, electric lime fields, thin borders, dark interface panels, and generous vertical pacing.

The screenshot gives reliable evidence for color, proportion, hierarchy, border weight, visual rhythm, and component character. It does not reveal the original font files, CSS values, breakpoints, hover states, or animation timings. The values below are measured or chosen to reproduce the visible result without claiming access to the source website.

## Direction

Kaushal AI should feel like one connected competency workspace, not a government portal assembled from unrelated dashboards. The visual language is direct and high-contrast. Evidence, progress, and decisions sit inside crisp bordered modules. Lime marks forward motion and verified state. Black panels hold dense summaries and consequential actions.

The reference is a marketing page, while Kaushal AI is mostly an operating interface. Preserve the reference's visual character, but keep task state, labels, controls, and data legible before adding expression.

## Observed reference inventory

- A centered white page approximately 1,310 px wide on a `#efefef` outer canvas.
- Large centered sans-serif headlines with tight tracking and compact line height.
- Body copy in a neutral sans-serif, usually 14 to 18 px at the reference width.
- Small outlined taxonomy tags. Their lettering has a monospaced character.
- Electric lime around `#b5f657` for primary calls to action and a large full-width section.
- Pale lime fields around `#dcffa1`, `#dbfca4`, and `#ebfccf` for cards, FAQ areas, and sectional fades.
- Near-black around `#0e0e0e`, with charcoal panels around `#1f1f1f`.
- Hairline neutral borders around `#d1d2d1`.
- Mostly square geometry with small corner radii. No pill-heavy interface.
- Soft neutral shadows on floating interface mockups. Lime glows appear behind a few feature panels.
- Alternating composition: centered thesis, asymmetric two-column features, a dark full-width panel, a lime immersion section, a two-column card grid, social proof, and a black footer.
- Graphic motifs use thin outlines, stacked rectangles, dots, arrows, and simple geometric diagrams.
- Color outside the lime, black, and neutral system appears only in small semantic markers or third-party icons.

## Tokens

### Color

```css
:root {
  --canvas: #efefef;
  --paper: #ffffff;
  --ink: #0e0e0e;
  --panel: #1f1f1f;
  --panel-soft: #282828;
  --muted: #5f605d;
  --muted-light: #a2a3a1;
  --line: #d1d2d1;
  --line-strong: #9a9b98;
  --lime: #b5f657;
  --lime-card: #dbfca4;
  --lime-soft: #dcffa1;
  --lime-wash: #ebfccf;
  --danger: #d84b3f;
  --warning: #f3c74f;
  --info: #6fc7df;
  --success: #8bd34f;
}
```

Use `--paper` for the main application sheet and `--canvas` outside it. Use `--ink` for primary text and controls. Use `--lime` for the main action, current progress, selected answers, and verified success. Use `--lime-soft` for larger backgrounds. Use `--panel` for summary modules and final calls to action.

Lime should own a region or state. Do not scatter tiny green accents across every card. Red, yellow, and blue are semantic markers only.

### Typography

The closest dependency-free match to the screenshot is a neo-grotesk system stack:

```css
--font-sans: Arial, "Helvetica Neue", Helvetica, sans-serif;
--font-mono: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
```

Do not introduce a serif. The reference depends on one sans-serif family changing scale and weight.

| Role | Desktop | Mobile | Weight | Line height | Tracking |
| --- | ---: | ---: | ---: | ---: | ---: |
| Display | 72 px | 46 px | 500 | 0.94 | -0.055em |
| Page title | 48 px | 36 px | 500 | 0.98 | -0.045em |
| Section title | 36 px | 30 px | 500 | 1.0 | -0.04em |
| Card title | 22 px | 20 px | 500 | 1.08 | -0.025em |
| Body large | 18 px | 17 px | 400 | 1.45 | -0.01em |
| Body | 15 px | 15 px | 400 | 1.5 | 0 |
| Small | 12 px | 12 px | 400 | 1.45 | 0 |
| Tag | 11 px | 11 px | 500 | 1 | 0.01em |

Headings use sentence case. Keep lines short. Display copy should rarely exceed 13 words.

### Spacing

Use a 4 px base unit.

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 24px;
--space-6: 32px;
--space-7: 48px;
--space-8: 64px;
--space-9: 96px;
--space-10: 128px;
```

Operational screens use 16 to 32 px gaps. Landing sections use 64 to 128 px gaps. Give headings more space above than below.

### Geometry

```css
--radius-xs: 4px;
--radius-sm: 8px;
--radius-md: 12px;
--radius-round: 999px;
--border: 1px solid var(--line);
--border-ink: 1px solid var(--ink);
```

Use `--radius-sm` for most cards, buttons, and fields. Reserve the full radius for status dots and circular icon holders. The design should read as precise and lightly rounded, not bubbly.

### Elevation and glow

```css
--shadow-float: 0 14px 32px rgb(14 14 14 / 14%);
--shadow-small: 0 6px 16px rgb(14 14 14 / 10%);
--glow-lime: 0 26px 52px rgb(181 246 87 / 55%);
```

Flat bordered modules are the default. Use neutral shadow only when an element visibly floats above another layer. Use lime glow behind one focal module per section at most. Do not use glass blur.

## Layout

### Application frame

- `body` uses `--canvas`.
- The application is a centered `--paper` sheet with `max-width: 1320px` and `min-height: 100vh`.
- Desktop page padding is 28 px at the shell and 56 to 72 px inside content regions.
- Main operational content should not exceed 1,120 px.
- At widths below 760 px, the sheet fills the viewport and content padding falls to 16 px.
- Avoid permanent side navigation. The reference's compact floating top navigation becomes Kaushal's shared shell.

### Grid

- Use a 12-column mental grid on desktop.
- Primary assessment content spans eight columns. Evidence and metrics span four.
- Feature rows may split 5/7 or 7/5 to create the reference's alternating rhythm.
- Tables and matrix editors may use the full content width.
- Collapse to one column below 900 px. Do not preserve a narrow right rail on tablets.

### Vertical pacing

- The first viewport should show the product name, current task, progress, and primary action without scrolling.
- Landing sections may use 96 to 144 px vertical padding.
- Operational sections use 32 to 56 px vertical padding.
- Dense tables use 14 to 18 px row padding.
- A dark or lime field should interrupt every three to five white sections on long pages.

## Shared components

### Top navigation

The desktop navigation is a compact white rounded rectangle with a 1 px gray border and a small shadow. It contains the Kaushal mark, route links, a demo-state label, and one lime primary action. Keep it centered and no wider than its content. On mobile, make it a full-width bar with the workspace links horizontally scrollable.

The mark is a black square with a small white inset square. It should not use a letter avatar.

### Buttons

- Primary: lime background, black text, 1 px lime border, 8 px radius.
- Secondary: white background, black text, 1 px black border.
- Dark: black background, white text.
- Danger: white background, dark red text, red border.
- Minimum height: 44 px.
- Horizontal padding: 16 to 20 px.
- Hover: move up 1 px and add a short shadow. Do not scale.
- Active: return to the baseline and reduce shadow.
- Disabled: keep the outline visible, reduce opacity to 0.45, and remove movement.
- Focus: 3 px black outline with a separate 2 px lime box-shadow halo.

Arrow labels use the visible right-arrow character `→`, matching the reference.

### Tags and eyebrows

Tags are small outlined rectangles with 4 px corners, mono text, and 6 px by 10 px padding. Use them for round names, status, competency domains, and evidence sources. Eyebrows may sit inside a tag or appear as small mono text. Do not use uppercase tracking as the default.

### Cards and surfaces

White cards use a 1 px gray border and 8 px radius. They do not need shadows. Dark cards use `--panel`, white text, and the same radius. Lime cards use `--lime-soft`, black text, and either no border or a 1 px black line.

Cards should have one clear purpose. Avoid nesting multiple bordered cards inside another bordered card. Divide dense content with hairlines.

### Form controls

- Text fields and textareas use white backgrounds, black text, a 1 px `--line-strong` border, and an 8 px radius.
- Focus changes the border to black and adds the lime focus ring.
- Textareas have a 120 px minimum height and visible resize affordance.
- Radio and checkbox controls use native inputs with lime accent color.
- A selected answer becomes a pale lime block with a black border.
- Error text sits below its control and never relies on red alone.

### Progress stepper

Render the assessment rounds as connected outlined blocks. The current block uses black fill with white text or lime fill with black text. Completed blocks use pale lime. Future blocks remain white. Each step shows its number and short label. Keep the four steps horizontally scrollable on narrow screens.

### Metrics

Metrics use large black numerals and small plain labels. The preferred treatment is a dark summary panel with three or six cells divided by subtle charcoal rules. Lime is reserved for the metric that expresses supported or completed work.

### Tables

Tables keep a white background, 1 px outer border, and black horizontal row rules at low opacity. Headers use mono 11 px text. Avoid tinted zebra stripes. Use lime chips for positive states and outline chips for neutral states. Preserve a minimum row target of 44 px.

### Alerts and empty states

- Informational alerts use `--lime-wash` with a black border.
- Warnings use a pale yellow field with a black border.
- Errors use a white field with a red left rule and black text.
- Empty states should state what is missing and the next available action. Do not add decorative illustrations.

## Kaushal route composition

### Home

Use a centered thesis like the reference, but prove Kaushal's mechanism in the first viewport. The hero should name the outcome, show the three-step evidence loop, and expose both workspaces. Follow it with a bordered assessment-flow demonstration, a black evidence panel, and a lime closing field. Do not copy Frame's customer logos, testimonials, or claims.

### Learner workspace

- Header: official identity, role, employee code, matrix version, and reassessment action.
- Progress: four-step connected strip directly below the header.
- Main column: one assessment round card with questions separated by hairlines.
- Side column: a black metrics panel followed by a plain learning-history list.
- Baseline choices: large tap targets, selected in pale lime.
- Written questions: prompt first, competency tag second, textarea third.
- Results: competency rows show assessed level, required level, gap, confidence, and evidence without hiding the numbers.
- Recommendations: use a lime section with black text and dark completion buttons.

### Administrator workspace

- Keep the top navigation shared with the learner surface.
- Use a large title, one sentence of context, then the working table or form.
- Analytics begin with a dark six-cell metric panel.
- Matrix editors use one bordered sheet with hairline-separated rows. Do not turn every competency into its own card.
- Publish is a lime primary action. Save draft is an outlined secondary action.

## Graphic language

Use small custom CSS or SVG diagrams built from 1 px black lines, dots, arrows, and stacked rectangles. Suitable motifs include a competency-to-evidence-to-course flow, nested matrix versions, confidence ticks, and connected assessment rounds.

Icons should be simple line or filled geometric marks. Use the existing Lucide package only when the icon matches this grammar. Keep icon strokes at 1.5 px or thinner. Do not place every icon in a colored rounded square.

## Motion

The static reference does not prove motion behavior. Use restrained operational motion:

- 140 ms for hover and press feedback.
- 220 ms for panels, accordion rows, and step changes.
- Ease out for entrances and ease in-out for state changes.
- Animate opacity and translation no more than 8 px.
- Do not hide initial content behind entrance animation.
- Respect `prefers-reduced-motion` and reduce all transitions to near-zero duration.

The signature transition is the assessment step handoff. The completed step fills lime, the next step becomes black, and the question panel changes with a short vertical fade. No confetti or gamified celebration.

## Responsive behavior

### Desktop, 1200 px and above

- Center the 1,320 px maximum paper sheet.
- Use a compact floating navigation.
- Use the 8/4 learner layout and full-width admin tables.
- Display headings at their largest scale.

### Tablet, 760 to 1199 px

- Reduce page padding to 32 px.
- Collapse learner content to one column below 900 px.
- Keep tables horizontally scrollable inside the paper sheet.
- Retain the compact navigation bar, but allow links to wrap once.

### Mobile, below 760 px

- Remove outer gray gutters.
- Use 16 px page padding.
- Reduce display type to 46 px and page titles to 36 px.
- Stack every feature, metric group, form action, and result row.
- Keep primary buttons full width when paired with another action.
- Preserve 44 px targets and avoid horizontal page overflow.
- Allow only the stepper and data tables to scroll horizontally.

## Accessibility

- Black on lime, black on white, and white on black are the core contrast pairs.
- Never place muted gray text on lime.
- Maintain a visible focus ring on every interactive control.
- Preserve native semantics for headings, tables, fieldsets, legends, labels, and buttons.
- Every progress state must have a text label in addition to color.
- Status chips need readable text such as `Published`, `Active`, or `Supported`.
- Loading, failure, empty, disabled, and provisional states require explicit copy.
- The complete learner flow must work by keyboard and at 390 px without page overflow.

## Copy rules

- Use direct institutional language.
- Prefer `Start assessment`, `Continue`, `Finish assessment`, and `Mark complete`.
- Keep domain terms intact: official, administrator, job role, competency matrix, assessment round, skill gap, confidence, supported result, and learning history.
- Do not invent customer counts, completion rates, endorsements, or performance claims.
- Avoid promotional filler and exclamation marks.

## Hard constraints

- No gradients used as generic decoration. Lime-to-white fades and blurred lime glows are allowed only where the reference uses them to transition between major fields.
- No glassmorphism.
- No serif headings.
- No permanent dark side rail.
- No large collection of rounded icon tiles.
- No excessive pills.
- No shadows on every card.
- No copied Frame logos, customer logos, testimonials, product screenshots, or claims.
- Preserve all current Kaushal behavior and real seeded data.

## Visual acceptance checklist

- The outer canvas is visibly light gray and the app sits on a centered white sheet at desktop widths.
- Near-black, white, lime, and pale lime dominate the render.
- The top navigation is compact and bordered, not a full-height side rail.
- Headings are large sans-serif with tight tracking and short line length.
- Tags are outlined and monospaced.
- Borders are 1 px and corners are small.
- At least one dark panel and one page-scale lime field appear on long pages.
- Selected, current, supported, and completed states use lime consistently.
- Dense operational screens remain easy to scan.
- Desktop and 390 px mobile layouts have no accidental horizontal overflow.
- Motion respects reduced-motion settings.

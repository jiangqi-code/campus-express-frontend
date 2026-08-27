---
name: "Campus Express"
description: "Campus Relay Board is a warm, operational web system for campus-service handoffs."
colors:
  navy: "#132f3f"
  primary: "#b74734"
  primary-hover: "#943827"
  primary-active: "#763021"
  primary-soft: "#f8e3da"
  mustard: "#b98216"
  mustard-soft: "#f8eed3"
  success: "#087c6d"
  success-soft: "#dcefe9"
  warning: "#9a6200"
  warning-soft: "#faedcf"
  info: "#236978"
  info-soft: "#dfeff0"
  text: "#19333d"
  text-secondary: "#36535c"
  text-muted: "#637a80"
  text-disabled: "#96a8ab"
  background: "#f2ece2"
  surface: "#fffdf8"
  fill: "#f7f1e8"
  fill-strong: "#e9ded0"
  border: "#ded4c7"
  border-strong: "#c8bbab"
typography:
  headline:
    fontFamily: "PingFang SC, Microsoft YaHei, Noto Sans CJK SC, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "clamp(24px, 3vw, 30px)"
    fontWeight: 760
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  body:
    fontFamily: "PingFang SC, Microsoft YaHei, Noto Sans CJK SC, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "14px"
    lineHeight: 1.55
  label:
    fontFamily: "PingFang SC, Microsoft YaHei, Noto Sans CJK SC, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 800
    letterSpacing: "0.04em"
rounded:
  button: "8px"
  card: "16px"
  large: "22px"
  pill: "999px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  5: "20px"
  6: "24px"
  7: "28px"
  8: "32px"
  10: "40px"
  12: "48px"
  16: "64px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.button}"
    height: "38px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.surface}"
    rounded: "{rounded.button}"
  button-outline-primary:
    textColor: "{colors.primary}"
    rounded: "{rounded.button}"
    height: "38px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "{spacing.6}"
  field:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.button}"
    height: "42px"
  filter-chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.pill}"
    padding: "5px 12px"
---

# Design System: Campus Express

## Overview

**Creative North Star: "Campus Relay Board"**

Campus Express is an operational campus-service system, not a generic dashboard. It makes every task read as a live handoff: a request begins, moves through pickup and delivery, and reaches a visible next action. Deep ink holds the utility frame; warm paper keeps the work surface welcoming; coral, mustard, and teal act as purposeful service signals.

The system is compact enough for repeated task scanning and administration, but never cold. Route lines, dot markers, small signal bars, and uneven punched-corner details create a shared service grammar across student, runner, and administrator work without turning dense views into illustrations. Visual attention must follow operational truth: current state, handoff, amount, risk, and the next action.

**Key Characteristics:**

- Deep-ink utility framing over warm-paper operational surfaces.
- Coral action, mustard attention, and teal completion used as semantic signals.
- A continuous route grammar for pickup, delivery, progress, and active navigation.
- Role-specific actions within one recognizably shared shell.
- Flat, bordered work surfaces with restrained interaction lift.

### Direction Contract

`src/layouts/MainLayout.vue` is the emitted source of the Campus Relay Board direction contract. Preserve its six commitments whenever the shell changes:

- **Thesis:** Campus Express is a precise campus relay board, not a generic dashboard.
- **Own world:** deep-ink navigation, warm-paper surfaces, coral actions, mustard attention, teal completion markers, and connected route lines.
- **Story:** every role can see the current handoff and the next action.
- **First viewport:** utility bar, route rail, work surface, and live context make the active route and its primary action immediate.
- **Form:** Campus Relay Board (direction 5; seed `43d60da0`).
- **Finish:** a visual change is not complete until it is reviewed and this document remains accurate; shipping raster assets, if any are introduced later, require provenance.

**The Contract-Preservation Rule.** Do not remove, weaken, or silently contradict the `directionContract` declaration or its mounted document comment. If the visual direction genuinely changes, update the contract, this document, the surface brief, and the direction decision together in the same change.

## Colors

The palette behaves like campus wayfinding: the neutral material recedes, while a small number of high-confidence signals identify action and state.

### Primary

- **Relay Coral** (`primary`, plus its hover, active, and soft companions): the sole default action color. Use for primary buttons, active routes, delivery endpoints, prices, and the smallest high-priority signals.

### Secondary

- **Attention Mustard** (`mustard`, `mustard-soft`): reserve for attention, priority, and the first outstanding step in a context sequence. It is not a second primary action.
- **Completion Teal** (`success`, `success-soft`): identifies successful completion, pickup origins, and positive service progress.
- **Information Teal-Blue** (`info`, `info-soft`): supports neutral informational state without competing with completion teal.
- **Warning Amber** (`warning`, `warning-soft`): indicates caution and account restrictions. Keep warnings distinct from destructive or primary action treatment.

### Neutral

- **Deep Ink** (`navy`): anchors the top utility bar, dark task-hall header, and high-emphasis navigation states.
- **Warm Campus Ground** (`background`): the quiet page field behind work surfaces.
- **Warm Paper** (`surface`): cards, fields, menus, dialogs, and readable work areas.
- **Paper Fill** (`fill`, `fill-strong`): low-contrast grouping, table headers, filter wells, steps, and placeholders.
- **Ink Text** (`text`, `text-secondary`, `text-muted`, `text-disabled`): preserves the reading hierarchy from task facts to supporting metadata.
- **Paper Rules** (`border`, `border-strong`): define containment and route structure before shadow is considered.

**The Semantic Signal Rule.** Coral, mustard, teal, warning, and info colors communicate different task meanings. Never use them merely to make a dense screen more colorful, and do not rely on color alone to communicate a status.

## Typography

**Display Font:** no separate display face; use the product sans stack.

**Body Font:** PingFang SC, Microsoft YaHei, Noto Sans CJK SC, system sans fallbacks.

**Character:** Compact, high-legibility Chinese-first sans typography lets route labels, task facts, money, and administration data scan quickly. Weight and scale establish urgency; decorative type never competes with service information.

### Hierarchy

- **Headline** (760, responsive headline scale, 1.25): page and work-surface titles; keep the tight tracking established in the token layer.
- **Body** (normal weight, base body scale, 1.55): task descriptions, forms, records, and explanatory text.
- **Emphasis** (700–800): primary actions, route destinations, prices, table headers, and state labels.
- **Label** (800, compact label scale, tracked): filter labels, table headings, menu group labels, and metadata captions.
- **Microcopy** (11–12px where already established): rail summaries, support text, status hints, and secondary route information; never use it for a primary action or critical state.

**The Scan-First Type Rule.** Put the task destination, state, amount, and action at clearly different visual weights before adding any extra decoration.

## Layout

The desktop shell is a bounded three-part relay board: a sticky left route rail, a flexible work surface, and a sticky right next-action context rail. It sits inside a maximum `1480px` frame with `40px` total viewport subtraction; the route rail is `242px`, the context rail is `216px`, and the lanes are separated by `28px`. The utility bar remains sticky above it, while page work stays in the central lane.

The role model changes content priority without changing the shell's grammar:

- **Student/user:** foreground publishing, task tracking, messages, wallet, coupons, and growth into runner status. The context rail’s action begins the request route.
- **Runner:** foregrounds claimable tasks, pickup/delivery confirmation, completion, earnings, withdrawals, and service statistics. The context rail starts with available tasks.
- **Administrator:** presents operational and governance work—users, tasks, orders, approvals, risk, logs, and configuration—in denser grouped navigation. Retain route markers and semantic color, but avoid decorative route treatment that slows tables and review work.

At widths below `1200px`, remove the right context rail while preserving the work surface and left navigation. Below `992px`, the shell becomes one column: the utility actions collapse behind the menu control and the route rail becomes a two-column grouped navigation area. Below `576px`, compact the top bar, hide non-essential brand/status text, and turn the route rail into horizontally scrollable route chips; retain the active state, controls, and a short scroll hint. Use the observed spacing scale to keep desktop density and mobile touch targets coherent.

**The Next-Action Rule.** Each route and role must expose one obvious next action near the top of the current work area. Responsive changes may reflow or collapse supporting context, but must not orphan that action.

## Elevation & Depth

This is a tonal, bordered system first. Cards, rails, dialogs, and fields are separated with warm paper, fill layers, and fine paper rules; ordinary cards are deliberately flat. Shadows are reserved for floating overlays such as menus and for rare emphasized depth. Hover movement—not permanent floating—is the typical confirmation that an interactive object can be engaged.

### Shadow Vocabulary

- **Soft lift** (`shadow-sm`): a subtle navy-tinted lift for limited emphasis where the layout needs separation.
- **Overlay lift** (`shadow-md`): menus and overlay-like surfaces.
- **High lift** (`shadow-lg`): exceptional, temporary elevation only.

**The Flat-at-Rest Rule.** Do not add arbitrary drop shadows to every card. Start with surface, border, and spacing; use elevation only when an object must rise above its context.

## Shapes

The form language is softly practical: buttons and fields use the compact button radius, cards and shell rails use the larger card radius, and major panels can use the large radius. Pills are reserved for tags, filter chips, and role/state labels. The CE mark and avatars use an asymmetric punched corner—three rounded corners with a tighter lower-left corner—to make the brand feel like a route slip rather than a generic app badge.

Route elements are intentionally geometric: thin vertical or horizontal paths with circular nodes, where pickup is teal and delivery is coral. Preserve sufficient contrast between route nodes and the warm-paper surface, and use labels or text alongside the nodes.

## Components

### Buttons

**Character:** decisive but compact service controls.

- **Shape:** soft compact corners using the button radius; standard controls have a minimum height of `38px`.
- **Primary:** relay coral fill with warm-paper text; hover moves to the primary-hover state and active moves to primary-active.
- **Outline:** coral outline for secondary actions that belong to the current flow; a darker secondary outline may become deep ink on hover.
- **Interaction:** enabled buttons rise by `1px` on hover, return at active, and retain the visible coral focus ring. Disabled controls remain legible but use reduced opacity and must not be the only explanation for an unavailable action.

### Filter Chips

**Character:** compact route selectors, not oversized segmented controls.

- **Default:** paper surface with a paper rule and secondary ink label.
- **Hover / active:** hover borrows the coral border and text; active becomes a coral-filled pill with warm-paper text.
- **Use:** group closely related task filters inside a low-contrast paper-fill well.

### Cards / Containers

**Character:** flat route slips on warm paper.

- **Corner Style:** card radius with a fine paper rule.
- **Background:** warm paper on the campus-ground field; use paper fill for grouped subareas.
- **Depth:** flat by default, with no permanent card shadow.
- **Internal Padding:** the standard card body uses the documented `24px` spacing step; dense task cards use locally tighter padding where their route marker needs room.

### Inputs / Fields

**Character:** quiet, solid fields that let data and status do the talking.

- **Style:** warm-paper background, paper rule, compact button radius, and a minimum `42px` height for Bootstrap form fields.
- **Focus:** switch the border/inset stroke to relay coral and add the shared coral focus ring.
- **Placeholder / disabled:** use the disabled text token for placeholders; do not use placeholder text as a field label.

### Navigation

**Character:** a service route map, not a generic side menu.

- **Desktop:** deep-ink utility bar anchors the page; the left rail groups routes by role and uses a small circular node for each route. Active links use a coral-soft field, coral text, and a filled node with a restrained halo.
- **Context rail:** on wide screens, the right rail names the next phase, provides a single primary action, and lists the immediate route steps.
- **Role behavior:** menu groups and context action must be derived from the signed-in user, runner, or administrator role while retaining the same route grammar.
- **Mobile:** collapse utility actions at the tablet breakpoint and convert the left rail to scrollable route chips on small phones. Do not remove route selection or the active-state cue.

### Relay Task Card

**Character:** a handoff strip that makes an anonymous task readable as a route.

- **Route spine:** a thin vertical paper-rule line sits behind two circular nodes; the pickup node is teal and the delivery node is coral.
- **Information order:** pickup and delivery destinations lead, then note and compact metadata; price and the runner's claim action remain visually separate at the edge.
- **Interaction:** hover may lift the card slightly and strengthen its border, never turn the worklist into a collection of heavily shadowed tiles.

### Status Tags

**Character:** concise semantic pills for state, not decorative labels.

- **Shape:** pill radius with strong, compact label typography.
- **Meaning:** choose the product semantic color that matches the state and pair it with text, iconography, or surrounding label context.

## Do's and Don'ts

### Do:

- **Do** lead every task or admin work area with current state and the next valid action.
- **Do** reuse the pickup-to-delivery route grammar when it helps people read a real handoff.
- **Do** keep action coral scarce and decisive; use mustard for attention and teal for completed/positive progress.
- **Do** retain warm-paper surfaces, fine borders, and flat-at-rest cards as the default material treatment.
- **Do** preserve role-specific navigation, context copy, and action targets when changing the shared shell.
- **Do** keep focus-visible affordances and reduced-motion behavior intact.

### Don't:

- **Don't** revert to generic blue-white-gray dashboard patterns or anonymous card grids.
- **Don't** treat route lines, nodes, or semantic colors as purely decorative motifs.
- **Don't** add persistent shadows, gradients, or ornamental patterns that obscure dense task and governance data.
- **Don't** let a compact mobile shell hide the current route, its active state, or the next action.
- **Don't** change the Campus Relay Board direction contract in isolation; keep its supporting design artifacts synchronized.

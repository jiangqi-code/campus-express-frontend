---
name: "Campus Express"
description: "Blue Black Dispatch is a focused, blue-black operating system for campus service work."
colors:
  navy: "#081120"
  primary: "#1457d9"
  primary-hover: "#0f47b7"
  primary-active: "#0a378e"
  primary-soft: "#e9f0ff"
  success: "#2164de"
  info: "#4c7ee6"
  text: "#0e172a"
  text-secondary: "#253552"
  text-muted: "#66738a"
  background: "#f4f7fc"
  surface: "#ffffff"
  fill: "#f7f9fd"
  fill-strong: "#e7edf7"
  border: "#dbe3f0"
  border-strong: "#bac8df"
typography:
  headline:
    fontFamily: "PingFang SC, Microsoft YaHei, Noto Sans CJK SC, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "clamp(25px, 3vw, 32px)"
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
  button: "6px"
  card: "10px"
  large: "12px"
  pill: "999px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  5: "20px"
  6: "24px"
  8: "32px"
  12: "48px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.button}"
    height: "38px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "{spacing.6}"
---

# Design System: Campus Express

## Overview

**Creative North Star: "Blue Black Dispatch"**

Campus Express is a campus service operating desk, not a themed dashboard. The look is built from midnight blue-black, cold white, one cobalt action signal, and precise rules. It is deliberately quiet: information leads, surfaces recede, and the active action is unmistakable.

The visual personality comes from editorial restraint rather than decoration. The dark command bar and white operating surfaces create a night-shift dispatch scene that remains readable in a dorm, library, or administrative office. No warm materials, playful route illustrations, color gradients, or multicolor state confetti are part of this direction.

### Direction Contract

`src/layouts/MainLayout.vue` emits the Blue Black Dispatch direction contract as both source declaration and mounted document comment. Preserve these commitments whenever the shell changes:

- **Thesis:** Campus Express is a blue-black campus dispatch desk, not a generic dashboard or decorative relay board.
- **Own world:** midnight navigation, ice-white work surfaces, one cobalt action signal, precise rules, and restrained blue state tones.
- **Story:** every role sees the current job and next valid action without visual noise.
- **First viewport:** command bar, compact work index, clear workspace, and current-action panel establish the task immediately.
- **Form:** Blue Black Dispatch, a distilled operating system for campus service.
- **Finish:** review and documentation are part of the visual deliverable; shipping raster assets require provenance.

If the direction changes again, update the contract, this document, the surface brief, and the direction-decision record in the same change.

## Colors

- **Midnight** (`navy`): the command bar, dark headers, and highest-emphasis navigation state.
- **Cobalt** (`primary`, hover, active, soft): the only default action signal. Use for primary controls, active selection, current price, focus, and the active status marker.
- **Blue state scale** (`success`, `info`, warning and danger variants): restrained blue values for status differentiation where the product needs it. Pair states with text; color alone is never meaning.
- **Ice surfaces** (`background`, `surface`, `fill`, `fill-strong`): a cool blue-white hierarchy for pages, working panels, and grouped controls.
- **Ink and rules** (`text`, secondary, muted, border): establish reading hierarchy and containment before depth is considered.

**Palette rule:** no coral, mustard, teal, warm paper, gradients, or unrelated accent colors. If a new color cannot be expressed as a blue-black or blue-white value, it does not belong in the system.

## Typography

The product uses the Chinese-first system sans stack for all interface type. Character comes from decisive weight, restrained negative tracking, and a visible scale jump between a page title, a task fact, and supporting metadata—not from a novelty display font.

- **Headline:** 760 weight, `clamp(25px, 3vw, 32px)`, compact tracking. Use once per main work area.
- **Body:** 14px / 1.55 for forms, task content, and records.
- **Label:** 12px, 800 weight, mild tracking for table headings, filters, and navigation groups.
- **Data:** use tabular numerals when showing amounts, counts, or timestamps where CSS support is available.

## Layout

Desktop uses a bounded three-part operating frame: work index at left, flexible work surface at center, and a current-action panel at right. The utility command bar remains at the top. This gives student, runner, and administrator workflows the same visual logic without making their information density identical.

- **Student:** publish, track, communicate, pay, and review.
- **Runner:** scan available work, confirm pickup and delivery, see earnings, and complete service.
- **Administrator:** operate, govern, audit, and configure in a denser information view.

At widths below `1200px`, hide the current-action rail. Below `992px`, stack the shell. Below `576px`, turn the work index into horizontally scrollable chips with a visible scroll hint; the active route and its primary action must remain available.

## Surfaces and Depth

Work is separated with cold-white surfaces and one-pixel blue-gray rules. Cards are flat at rest. Borders are preferred to shadows; shadows are limited to true overlays such as account menus. Standard radii are deliberately compact: 6px controls and 10px panels.

The dark headers in task hall, publishing, profile, and administration rely on their midnight field and clear type rather than illustrations, rings, decorative geometry, or thick color accents.

## Components

### Primary action

Use a cobalt-filled 38px control with white text. One decisive action should dominate its current surface. Secondary actions are quiet outlines; they never compete with the primary action through a second color.

### Work index

The left navigation is a compact index, not a scenic route map. The active item becomes a midnight field with white text and a cobalt node. Group labels remain subdued and the rail summary uses midnight rather than a colored card.

### Current-action panel

On wide screens, the right panel names the immediate action and provides one full-width primary control. The ordered list below it communicates procedural sequence only; it must not become a decorative checklist.

### Task and order flow

Pickup and delivery can still use a slim two-node line because it represents real handoff information. Both ends sit on the blue scale: lighter blue for the origin, cobalt for the destination. Do not add gradients or ornamental lines.

### Data strip and charts

The operations dashboard starts with a continuous segmented data strip, not a row of isolated KPI cards. Charts use solid cobalt and blue-scale series only; axis rules remain light and charts never use gradients.

## Interaction and accessibility

- Every focusable control uses the shared cobalt focus ring.
- Hover is a 1px lift or a border/background change, never permanent elevation.
- Disabled, loading, empty, and error states stay legible on blue-white surfaces.
- Respect reduced-motion preferences.
- Preserve current route, current status, and next action at every responsive breakpoint.

## Do's and Don'ts

### Do

- Lead each page with the current work and one next valid action.
- Use cobalt sparingly and decisively.
- Let white space, type scale, and one-pixel rules create hierarchy.
- Preserve the three-role shell and real task-route information.
- Keep charts, fields, scrollbars, selection, and focus states inside the same blue-black system.

### Don't

- Do not return to warm paper, coral, mustard, teal, or multicolor status decoration.
- Do not use gradients, atmospheric blobs, route illustrations, or ornamental header art.
- Do not rebuild views as a grid of identical metric cards.
- Do not hide a primary action behind visual noise or dense navigation.
- Do not change the direction contract without synchronizing the supporting design records.

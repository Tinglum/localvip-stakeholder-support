# Frontend Rules

## Applies To

All frontend-related files:

* components
* pages / routes
* layouts
* UI primitives
* styling systems
* design tokens
* frontend utilities

---

## Priority Levels

### Critical (must always be followed)

### Important (should be followed unless strong reason not to)

### Optional (nice improvements when relevant)

---

## Critical Rules

### 1. Preserve Functionality

* Do not break existing behavior
* Do not remove working logic unless replacing it safely
* Do not introduce regressions

---

### 2. Respect Scope

* Only modify what is necessary
* Do not redesign unrelated areas
* Do not perform large rewrites unless explicitly requested

---

### 3. Maintain Codebase Consistency

* Follow existing component patterns where they are strong
* Reuse existing utilities and tokens
* Do not introduce conflicting styling systems
* Do not mix multiple design approaches

---

### 4. Ensure Usability

Every UI must:

* be readable
* be navigable
* be responsive
* have clear hierarchy

Include when relevant:

* loading state
* empty state
* error state

---

### 5. Accessibility Minimum

* Visible focus states for interactive elements
* Sufficient contrast for text
* Click targets large enough to use
* Avoid interaction that depends only on color

---

## Important Rules

### 6. High-Quality Design (Non-Generic)

Avoid:

* default buttons
* flat, boring cards
* uniform grid layouts without hierarchy
* template SaaS look

Prefer:

* strong hierarchy
* refined spacing
* intentional layout
* visually distinct sections
* subtle depth and layering

---

### 7. Layout Discipline

* Do not default to identical card grids
* Use hierarchy-driven sizing
* Allow asymmetry when it improves clarity
* Use spacing intentionally, not arbitrarily

---

### 8. Component Quality

* Components must be modular and reusable
* Avoid overly large components
* Avoid duplicated UI logic
* Keep props clear and minimal

---

### 9. Interaction Quality

Interactive elements must have:

* hover state
* active state
* focus-visible state

For key actions:

* clear visual emphasis
* feedback on interaction

---

### 10. Motion Discipline

Use motion to:

* improve clarity
* improve perceived quality
* guide attention

Avoid:

* unnecessary animation
* distracting effects
* motion without purpose

---

## Optional Improvements

### 11. Visual Refinement

When appropriate:

* add depth (shadow, layering)
* refine typography hierarchy
* improve spacing rhythm
* enhance visual grouping

---

### 12. Micro-Interactions

For high-value UI:

* subtle hover lift
* smooth transitions
* tactile press feedback

---

## Good vs Bad

### Good

* Clear hierarchy
* Intentional spacing
* Responsive layout
* Modular components
* Consistent styling
* Usable states (loading, empty, error)

### Bad

* Everything looks the same
* Random spacing
* Generic UI patterns
* No interaction feedback
* No states
* One large component doing everything

---

## Violation Handling

If rules are violated:

1. Fix critical issues immediately
2. Improve important issues when low-risk
3. Note optional improvements in summary

Do not introduce breaking changes to fix minor issues.

---

## Efficiency Constraints

* Do not rewrite entire files unnecessarily
* Prefer editing existing components
* Output only changed files or sections when possible
* Avoid unnecessary verbosity

---

## Guiding Principle

Frontend should feel:

* intentional
* structured
* high-quality
* non-generic

Without becoming:

* overdesigned
* inconsistent
* or unnecessarily complex

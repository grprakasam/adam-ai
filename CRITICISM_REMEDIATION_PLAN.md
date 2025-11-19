# Criticism Remediation Plan

This document tracks how we are addressing the open audit items around security, accessibility, error recovery, user guidance, and customization. Each section below outlines the immediate fixes implemented in this iteration and the backlog follow-ups for deeper coverage.

---

## 1. Security – SECRET_KEY handling

| Item | Resolution |
| --- | --- |
| Move `SECRET_KEY` to environment variable | Replace the hard-coded constant in `backend/app/core/auth.py` with `settings.SECRET_KEY` (loaded from `.env`). Update `.env` template and config validation to ensure a value is supplied. |

Follow-up: add runtime validation that rejects default secrets in production deployments (leveraging `config_secure.py`).

---

## 2. Accessibility

| Criticism | Action (Phase 1) | Future Enhancements |
| --- | --- | --- |
| No WCAG 2.1 documentation | Document implemented controls directly in this plan and upcoming release notes. | Perform full WCAG audit and add AXE automated tests. |
| Limited keyboard navigation & no focus indicators | Introduce a persistent “Skip to Content” link, reinforce focus outlines with CSS, and ensure panel toggles/toolbars have `aria` labels. | Add keyboard shortcuts for workspace tabs and modals. |
| No screen reader optimization | Add `aria-live` regions for auto-save + error banners and label major layout sections. | Audit every custom component for semantic markup. |
| Insufficient color contrast | Ship high-contrast + dark themes with WCAG AA compliant tokens. | Run automated color contrast testing. |

---

## 3. Error Recovery

| Criticism | Action (Phase 1) | Future Enhancements |
| --- | --- | --- |
| Inconsistent error messages | Route workspace-level errors through a new Recovery Helper that suggests next steps. | Consolidate backend error payload formats. |
| No undo/redo + no auto-save | Extend `projectStore` with history stacks and expose Undo/Redo controls; surface the existing persistence layer via an auto-save indicator. | Expand history to additional tabs/modules. |
| No recovery suggestions | Add contextual tips into the new Help & Recovery drawer whenever an operation fails. | Tie into backend health endpoints for tailored advice. |

---

## 4. User Guidance

| Criticism | Action (Phase 1) | Future Enhancements |
| --- | --- | --- |
| Limited tooltips | Expand descriptive tooltips to the header actions and new accessibility controls. | Map tooltips to every core control. |
| No interactive tutorials / contextual help | Introduce a Guidance Drawer with step-by-step checklists, keyboard shortcuts, and quick start flows. | Layer in guided tours (e.g., Joyride) per persona. |
| Documentation external to app | Embed distilled docs (FAQs, readiness checklist) directly in the Guidance Drawer. | Sync in-app docs with versioned Confluence space automatically. |

---

## 5. Customization

| Criticism | Action (Phase 1) | Future Enhancements |
| --- | --- | --- |
| No dark mode / font size / layout customization | Add a Preferences context that drives light, dark, and high-contrast themes, adjustable font scale, and density controls stored in `localStorage`. | Allow per-tab layouts and code editor themes. |
| No user preferences storage | Persist accessibility/customization choices via the new context + Zustand bridge. | Sync preferences per user account once backend profiles exist. |

---

## Phase 1 Deliverables (this change set)

1. Backend `SECRET_KEY` pulled from environment variables with validation and updated templates.
2. Accessibility infrastructure: skip link, focus-visible styles, semantic labelling, theme tokens, and `AccessibilityToolbar`.
3. Customization + user guidance + error recovery improvements:
   - Preferences context with dark/high-contrast themes, font scaling, and layout density settings.
   - Auto-save indicator, undo/redo controls for project configuration, and a recovery helper message surface.
   - Guidance drawer consolidating tutorials, FAQs, and keyboard navigation instructions.

Each deliverable is implemented without altering the existing workflows—default behavior remains unchanged until a user toggles a preference or opts into the guidance surfaces.

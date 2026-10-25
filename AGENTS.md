# Marauders Map

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues for `olillevik/marauders-map`, using the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Triage uses the five default labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Issue hierarchy

Never publish a ticket as a standalone issue. Every ticket is a sub-issue of the feature or bug issue it implements.

- `/to-spec` publishes the feature spec as an issue. A bug issue already on the tracker works the same way.
- Run `/to-tickets` with that issue's number, such as `#42`, so the skill uses it as the source issue. Each ticket it publishes becomes a sub-issue of that issue.
- Create each sub-issue with the sub-issue command in `docs/agents/issue-tracker.md`.
- Publish tickets in dependency order, blockers first, as `/to-tickets` requires.
- Do not change the parent issue's body.
- The parent issue may be closed once all its sub-issues are closed. This overrides the `/to-tickets` rule that the parent is never closed.

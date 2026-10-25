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
- The parent issue may be closed once all its sub-issues are closed. This overrides the `/to-tickets` rule that the parent is never closed.

## BarentsWatch client secret

`npm run dev` runs through `scripts/with-keychain-secret.sh`. `npm run test:full` also runs through the wrapper. The wrapper reads the client secret from the macOS keychain (service `barentswatch-ais`, account `client_secret`) and passes it to the server as `BARENTSWATCH_CLIENT_SECRET`. The secret is never printed, logged, or saved to a file. Keep it out of command output, logs, and `.env`. The Husky pre-commit hook runs `npm run test:full` on every commit. That run includes one real BarentsWatch smoketest, which makes two HTTP requests.

The client ID is not secret. It goes in `.env`, which is gitignored. `.env.example` shows the variable.

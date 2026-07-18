# Capital Mat Calls

Team schedule for Capital MMA / Capital Jiu-Jitsu athletes at the 2026 IBJJF Virginia Open.

## How updates work

The updater in `scripts/update_schedule.py` rebuilds `public/data/schedule.json` from the official IBJJF athlete lists, division schedule, brackets, and single-competitor tables. GitHub Actions runs it every 15 minutes and commits only verified changes.

The deployed website requests `/api/schedule` from its own origin. That endpoint reads the latest verified JSON from this repository, so schedule changes appear on the site without a new deployment. The bundled JSON remains the page's fallback if GitHub is temporarily unavailable.

It includes athletes registered under Capital MMA or Capital Jiu-Jitsu, always checks for Chad Malone and Nicholas/Nick Jay under alternate academies, and preserves the last known-good file if the scrape is incomplete or suspicious.

## Run an update

```bash
python3 -m pip install -r requirements-update.txt
python3 scripts/update_schedule.py
```

Useful checks:

```bash
python3 scripts/update_schedule.py --dry-run
python3 scripts/update_schedule.py --validate-only
npm test
```

Edit `config/schedule-overrides.json` to add academy aliases or special athletes. The scheduled workflow can also be run manually from the repository's Actions tab.

The `.ics` downloads are generated in the browser from the same current JSON data, so both the combined calendar and individual athlete calendar files stay in sync with the page.

# deadreckoning — Utah Prop 4 Petition Tracker

A real-time dashboard tracking the Utah "Repeal of the Independent Redistricting Commission and Standards Act" ballot initiative petition. It fetches the official signer spreadsheet from the Utah Lt. Governor's website daily, counts verified signatures by Senate district, computes per-district and overall ballot-qualification probabilities using exact dynamic programming, and serves an interactive dashboard at [deadreckoning.t8rsk8s.io](https://deadreckoning.t8rsk8s.io). No database, no servers — everything runs through GitHub Actions and Azure Static Web Apps.

---

## 1. Local Development Setup

### Python (scraper + processor)

```bash
# Install dependencies
pip install -r requirements.txt

# Fetch the latest xlsx from the LG website
python scripts/scraper.py

# Process it into public/data.json
python scripts/process.py

# Or process a specific file
python scripts/process.py --file data/manual/myfile.xlsx

# Debug the scraper (dumps raw page HTML to stdout)
python scripts/scraper.py --debug
```

### Node / React frontend

```bash
# Install dependencies
npm install

# Start dev server (hot reload, reads public/data.json)
npm run dev
# → http://localhost:5173

# Production build
npm run build
# → dist/
```

---

## 2. Feeding a New Spreadsheet Manually

When the LG website is down or you have a newer file before the scheduled scrape:

1. Drop the `.xlsx` file into `data/manual/`
2. Commit and push — the `push: paths: data/manual/**` trigger fires automatically
3. The workflow runs `scraper.py`, which detects the manual file (newer than `data/latest.xlsx`), moves it to `data/snapshots/`, and copies it to `data/latest.xlsx`
4. `process.py` runs next and writes `public/data.json`
5. The build-and-deploy job deploys the updated dashboard

You can also trigger manually any time from the GitHub Actions tab → **Fetch and Process Petition Data** → **Run workflow**.

---

## 3. Azure Static Web Apps Setup (4-step summary)

1. **Create a Static Web App** in the [Azure Portal](https://portal.azure.com) → Static Web Apps → Create.
   - Source: GitHub · Repo: this repo · Branch: `main`
   - Build preset: Custom · App location: `/` · Output location: `dist`
   - Leave API location blank

2. **Copy the deployment token** — Azure generates a `AZURE_STATIC_WEB_APPS_API_TOKEN` and can add it to your repo secrets automatically, or copy it manually.

3. **Add the secret to GitHub** → Repo → Settings → Secrets and variables → Actions → New repository secret:
   - Name: `AZURE_STATIC_WEB_APPS_API_TOKEN`
   - Value: the token from Azure

4. **Configure your custom domain** in Azure Portal → Static Web App → Custom domains → Add.
   Add a CNAME pointing `deadreckoning.t8rsk8s.io` → the `.azurestaticapps.net` hostname Azure assigned.

Full Azure docs: https://learn.microsoft.com/en-us/azure/static-web-apps/get-started-portal

---
## 4. Updating the Probability Model

The model lives in `scripts/process.py`. Key tunable constants at the top of the file:

- **`THRESHOLDS`** dict — update if the LG office revises district thresholds (D8 and D9 were revised Feb 5, 2026).
- **`REMOVAL_PRIOR`** inside `bayesian_removal_rate()` — currently `0.0165` (1.65%), derived from county clerk removal-request data as of Feb 12, 2026. Update if better empirical data becomes available.
- **`CORRELATION_PENALTY_SCALE`** — currently `0.030` (3%). Scales the inter-district correlation deflator applied to `p_qualify`.
- **`LG_LAG_DAYS`** — currently `14`. The number of calendar days over which the LG posting lag weight decays. Empirically calibrated from Feb 16–20 data showing 25.8% post-deadline gain rate.

After editing:

```bash
# Rebuild history from all snapshots (if adding new ones)
.venv/bin/python scripts/replay.py

# Regenerate data.json
.venv/bin/python scripts/process.py

# Check output
python3 -c "import json; d=json.load(open('public/data.json')); print(d['overall']['pQualify'], d['overall']['expectedDistricts'])"
```

The JavaScript mirror at `src/lib/probability.js` exports `THRESHOLDS` and `TIER_CONFIG` — keep these in sync if you change district thresholds.

See `MODEL-DESCRIPTION.md` for a full description of all model components.

---

## 6. Key Dates

| Date | Event |
|------|-------|
| Oct 24, 2025 | Petition filed |
| Feb 15, 2026 | Signature submission deadline (passed) |
| **Mar 9, 2026** | County clerk verification deadline — **we are here** |
| Mar 9, 2026 | Public list should reflect all verified + removed signatures |
| Nov 3, 2026 | General election (if petition qualifies) |

---

## 7. Repo Structure

```
/
├── scripts/
│   ├── scraper.py        ← fetches xlsx from vote.utah.gov
│   └── process.py        ← parses xlsx → public/data.json
├── data/
│   ├── manual/           ← drop xlsx here for manual processing
│   └── snapshots/        ← daily auto-archived snapshots (gitignored)
├── public/
│   └── data.json         ← THE output; React reads this; committed to repo
├── src/
│   ├── App.jsx
│   ├── components/
│   │   ├── SnapshotBoxes.jsx
│   │   ├── StatCards.jsx
│   │   ├── DistributionChart.jsx
│   │   └── DistrictTable.jsx
│   └── lib/
│       └── probability.js
├── .github/workflows/
│   ├── fetch.yml         ← daily data pipeline (scrape → replay → process → deploy)
│   └── deploy.yml        ← frontend-only deploy on non-data pushes to main
├── staticwebapp.config.json
├── index.html
├── vite.config.js
└── package.json
```

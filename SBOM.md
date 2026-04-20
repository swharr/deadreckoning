# Software Bill of Materials

## Frontend (React/Vite)

### Production Dependencies

| Package | Version | License | Purpose |
|---------|---------|---------|---------|
| react | 18.3.1 | MIT | UI component library |
| react-dom | 18.3.1 | MIT | React DOM rendering |
| @microsoft/applicationinsights-web | 3.3.11 | MIT | Azure Application Insights telemetry SDK |

### Dev Dependencies

| Package | Version | License | Purpose |
|---------|---------|---------|---------|
| vite | 8.0.9 | MIT | Frontend build tool and dev server |
| @vitejs/plugin-react | 5.2.0 | MIT | React support plugin for Vite |
| vitest | 4.1.0 | MIT | Unit testing framework |
| @testing-library/react | 16.3.2 | MIT | React component testing utilities |
| @testing-library/jest-dom | 6.9.1 | MIT | Custom DOM matchers for jest/vitest |
| jsdom | 29.0.1 | MIT | DOM environment for testing |
| eslint | 10.0.3 | MIT | JavaScript/JSX linter |
| @eslint/js | 10.0.1 | MIT | ESLint core JavaScript rules |
| globals | 17.4.0 | MIT | Global variable definitions for ESLint |

## Backend (Python)

| Package | Version | License | Purpose |
|---------|---------|---------|---------|
| requests | 2.33.1 | Apache-2.0 | HTTP client for fetching xlsx from LG office |
| beautifulsoup4 | 4.12.3 | MIT | HTML parsing for scraper page scraping |
| openpyxl | 3.1.2 | MIT | Excel (.xlsx) file reading |
| lxml | 5.1.0 | BSD-3-Clause | Fast HTML parser backend for BeautifulSoup |
| python-dateutil | 2.9.0 | Apache-2.0 / BSD-3-Clause | Date/time parsing and utilities |

## Runtime Services

| Service | Provider | Purpose |
|---------|----------|---------|
| Azure Application Insights | Microsoft | Frontend telemetry, error tracking, and usage analytics |
| Azure Static Web Apps | Microsoft | Static site hosting and deployment |
| GitHub Actions | GitHub | CI/CD pipeline — daily data fetch, build, and deploy |
| vote.utah.gov | Utah Lt. Governor | Source xlsx for petition signature data |

Last updated: 2026-04-20

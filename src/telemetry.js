/**
 * telemetry.js — Azure Application Insights wrapper
 * Connection string is injected at build time from APPINSIGHTS_CONNECTION_STRING env var.
 * In local dev (no env var set) all calls are no-ops.
 */
import { ApplicationInsights } from '@microsoft/applicationinsights-web'

const connStr = __APPINSIGHTS_CONNECTION_STRING__

let appInsights = null

if (connStr) {
  appInsights = new ApplicationInsights({
    config: {
      connectionString: connStr,
      enableAutoRouteTracking: true,
      disableCookiesUsage: true,        // privacy-first: no cookies
      disableAjaxTracking: false,       // track fetch/XHR (data.json load)
      // Exclude privacy-sensitive local lookup assets used by SignatureLookup.
      excludeRequestFromAutoTrackingPatterns: [
        /\/lookup\.json(?:\?|$)/i,
        /\/districts-by-zip\.json(?:\?|$)/i,
      ],
      enableCorsCorrelation: false,
      samplingPercentage: 100,
    },
  })
  appInsights.loadAppInsights()
  appInsights.trackPageView()
}

/**
 * Track a named custom event with optional properties.
 * Safe to call even if App Insights is not initialized (local dev).
 */
export function trackEvent(name, properties = {}) {
  appInsights?.trackEvent({ name }, properties)
}

export default appInsights

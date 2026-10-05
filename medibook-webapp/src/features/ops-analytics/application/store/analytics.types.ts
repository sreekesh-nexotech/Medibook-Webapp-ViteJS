/**
 * Usage-analytics UI vocabulary (audit 2.5 / SA-05: the period control must
 * change every figure). The figures themselves are the analytics API's
 * entities; these types only describe what the screen has selected.
 */

/** The windows the analytics screen reports on. */
export type AnalyticsPeriod = 'Last 7 days' | 'Last 30 days' | 'Last 90 days' | 'Last 12 months';

/** Which section of the analytics screen is showing. */
export type AnalyticsTab = 'Bookings' | 'Providers' | 'Error Rates';

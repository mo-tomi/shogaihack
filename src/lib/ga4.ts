import { BetaAnalyticsDataClient } from '@google-analytics/data';

export async function fetchPageViews(): Promise<Map<string, number>> {
  const propertyId = import.meta.env.GA4_PROPERTY_ID;
  const credentialsJson = import.meta.env.GA4_CREDENTIALS_JSON;

  if (!propertyId || !credentialsJson) {
    console.warn('[GA4] Missing GA4_PROPERTY_ID or GA4_CREDENTIALS_JSON — falling back to date sort');
    return new Map();
  }

  try {
    const credentials = JSON.parse(
      Buffer.from(credentialsJson, 'base64').toString('utf-8')
    );

    const client = new BetaAnalyticsDataClient({
      credentials: {
        client_email: credentials.client_email,
        private_key: credentials.private_key,
      },
    });

    const [response] = await client.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
      dimensions: [{ name: 'pagePath' }],
      metrics: [{ name: 'screenPageViews' }],
      dimensionFilter: {
        filter: {
          fieldName: 'pagePath',
          stringFilter: { matchType: 'BEGINS_WITH', value: '/blog/' },
        },
      },
      limit: 100,
    });

    const views = new Map<string, number>();
    for (const row of response.rows ?? []) {
      const path = row.dimensionValues?.[0]?.value ?? '';
      const count = Number(row.metricValues?.[0]?.value ?? 0);
      // /blog/adhd-lifehack → adhd-lifehack
      const slug = path.replace(/^\/blog\//, '').replace(/\/$/, '');
      if (slug) {
        views.set(slug, (views.get(slug) ?? 0) + count);
      }
    }

    console.log(`[GA4] Fetched page views for ${views.size} articles`);
    return views;
  } catch (err) {
    console.warn('[GA4] Failed to fetch page views:', err);
    return new Map();
  }
}

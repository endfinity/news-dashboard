import express from 'express';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

const NEWSAPI_BASE_URL = 'https://newsapi.org/v2/top-headlines';
const NEWSAPI_KEY = process.env.NEWSAPI_KEY;

const CACHE_TTL_MS = Number.parseInt(process.env.NEWS_CACHE_TTL_MS, 10) || 60_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = Number.parseInt(process.env.NEWS_RATE_LIMIT_PER_WINDOW, 10) || 60;

const headlinesCache = new Map();
let rateLimitWindowStart = Date.now();
let rateLimitedRequestCount = 0;

const metrics = {
  cacheHits: 0,
  cacheMisses: 0,
  rateLimitHits: 0,
  headlinesRequests: 0,
  lastNewsApiCallAt: null
};

app.set('trust proxy', 1);

if (!NEWSAPI_KEY) {
  // eslint-disable-next-line no-console
  console.warn('WARNING: NEWSAPI_KEY is not set. API requests will fail until you configure it.');
}

app.use(express.static(path.join(__dirname, '..', 'public')));

const CATEGORY_MAP = {
  general: { category: 'general' },
  business: { category: 'business' },
  entertainment: { category: 'entertainment' },
  health: { category: 'health' },
  science: { category: 'science' },
  sports: { category: 'sports' },
  technology: { category: 'technology' }
};

app.get('/health', (req, res) => {
  const health = {
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    hasNewsApiKey: Boolean(NEWSAPI_KEY),
    environment: process.env.NODE_ENV || 'development'
  };

  res.json(health);
});

app.get('/metrics', (req, res) => {
  const snapshot = {
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    cache: {
      ttlMs: CACHE_TTL_MS,
      size: headlinesCache.size,
      hits: metrics.cacheHits,
      misses: metrics.cacheMisses
    },
    rateLimit: {
      windowMs: RATE_LIMIT_WINDOW_MS,
      maxRequestsPerWindow: RATE_LIMIT_MAX_REQUESTS,
      currentWindowStart: new Date(rateLimitWindowStart).toISOString(),
      currentWindowCount: rateLimitedRequestCount,
      totalRateLimitHits: metrics.rateLimitHits
    },
    headlines: {
      totalRequests: metrics.headlinesRequests,
      lastNewsApiCallAt: metrics.lastNewsApiCallAt
    }
  };

  res.json(snapshot);
});

app.get('/api/headlines', async (req, res) => {
  if (!NEWSAPI_KEY) {
    res.status(500).json({ error: 'NEWSAPI_KEY is not configured on the server.' });
    return;
  }

  metrics.headlinesRequests += 1;

  const uiCategory = (req.query.category || 'general').toString().toLowerCase();
  const mapped = CATEGORY_MAP[uiCategory] || CATEGORY_MAP.general;

  const rawSearchQuery = typeof req.query.q === 'string' ? req.query.q : '';
  const searchQuery = rawSearchQuery.trim();

  let page = Number.parseInt(req.query.page, 10);
  let pageSize = Number.parseInt(req.query.pageSize, 10);

  if (!Number.isFinite(page) || page < 1) {
    page = 1;
  }

  if (!Number.isFinite(pageSize) || pageSize < 1 || pageSize > 50) {
    pageSize = 20;
  }

  const cacheKeyParts = [uiCategory, searchQuery || '', String(page), String(pageSize)];
  const cacheKey = cacheKeyParts.join('|');

  const cachedEntry = headlinesCache.get(cacheKey);
  if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
    metrics.cacheHits += 1;
    res.setHeader('X-Cache', 'HIT');
    res.json(cachedEntry.payload);
    return;
  }

  metrics.cacheMisses += 1;

  const now = Date.now();
  if (now - rateLimitWindowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitWindowStart = now;
    rateLimitedRequestCount = 0;
  }

  rateLimitedRequestCount += 1;

  if (rateLimitedRequestCount > RATE_LIMIT_MAX_REQUESTS) {
    metrics.rateLimitHits += 1;
    res.status(429).json({ error: 'Rate limit exceeded for headlines API. Please try again shortly.' });
    return;
  }

  const params = new URLSearchParams({
    country: 'us',
    category: mapped.category,
    page: String(page),
    pageSize: String(pageSize)
  });

  let combinedQuery = '';

  if (mapped.q && searchQuery) {
    combinedQuery = `${mapped.q} ${searchQuery}`;
  } else if (mapped.q) {
    combinedQuery = mapped.q;
  } else if (searchQuery) {
    combinedQuery = searchQuery;
  }

  if (combinedQuery) {
    params.set('q', combinedQuery);
  }

  const url = `${NEWSAPI_BASE_URL}?${params.toString()}`;

  try {
    metrics.lastNewsApiCallAt = new Date().toISOString();

    const response = await fetch(url, {
      headers: {
        'X-Api-Key': NEWSAPI_KEY
      }
    });

    if (!response.ok) {
      const errorBody = await response.text();
      // eslint-disable-next-line no-console
      console.error('NewsAPI responded with non-OK status', {
        status: response.status,
        statusText: response.statusText,
        url,
        bodySnippet: errorBody.slice(0, 500)
      });

      res
        .status(response.status)
        .json({
          error: 'News API request failed',
          status: response.status,
          statusText: response.statusText
        });
      return;
    }

    const data = await response.json();
    const payload = {
      status: data.status,
      totalResults: data.totalResults,
      articles: data.articles || [],
      page,
      pageSize
    };

    headlinesCache.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      payload
    });

    res.setHeader('X-Cache', 'MISS');
    res.json(payload);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error fetching headlines from NewsAPI', {
      message: error.message,
      name: error.name,
      stack: error.stack,
      url
    });

    res.status(500).json({ error: 'Failed to fetch headlines from NewsAPI.' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`News dashboard server running at http://localhost:${port}`);
});

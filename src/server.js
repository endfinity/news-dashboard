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
const METRICS_TOKEN = process.env.METRICS_TOKEN;

const CACHE_TTL_MS = Number.parseInt(process.env.NEWS_CACHE_TTL_MS, 10) || 60_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = Number.parseInt(process.env.NEWS_RATE_LIMIT_PER_WINDOW, 10) || 60;

class LRUCache {
  constructor(maxSize) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key) {
    const value = this.cache.get(key);
    if (value === undefined) return undefined;
    // Move accessed item to the end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Map preserves insertion order, so the first key is the least recently used
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  delete(key) { return this.cache.delete(key); }
  has(key) { return this.cache.has(key); }
  clear() { this.cache.clear(); }
  keys() { return this.cache.keys(); }
  values() { return this.cache.values(); }
  get size() { return this.cache.size; }
  entries() { return this.cache.entries(); }
}

// Bounded LRU cache to prevent memory leaks
const headlinesCache = new LRUCache(1000);

// Periodically clean up expired cache entries
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of headlinesCache.entries()) {
    if (value.expiresAt <= now) {
      headlinesCache.delete(key);
    }
  }
}, Math.max(CACHE_TTL_MS, 60_000));

const ipRateLimits = new Map();

const metrics = {
  cacheHits: 0,
  cacheMisses: 0,
  rateLimitHits: 0,
  headlinesRequests: 0,
  lastNewsApiCallAt: null
};

app.set('trust proxy', 1);

if (!NEWSAPI_KEY) {
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
  const token = req.get('X-Metrics-Token');
  if (!METRICS_TOKEN || token !== METRICS_TOKEN) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

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
      trackedIPs: ipRateLimits.size,
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

  const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  let clientLimitData = ipRateLimits.get(clientIp);

  if (!clientLimitData || now - clientLimitData.windowStart > RATE_LIMIT_WINDOW_MS) {
    clientLimitData = {
      windowStart: now,
      requestCount: 0
    };
  }

  clientLimitData.requestCount += 1;
  ipRateLimits.set(clientIp, clientLimitData);

  if (clientLimitData.requestCount > RATE_LIMIT_MAX_REQUESTS) {
    metrics.rateLimitHits += 1;
    res.status(429).json({ error: 'Rate limit exceeded for headlines API. Please try again shortly.' });
    return;
  }

  // Cleanup old IP entries periodically, when the Map gets too large
  if (ipRateLimits.size > 1000) {
    for (const [key, value] of ipRateLimits.entries()) {
      if (now - value.windowStart > RATE_LIMIT_WINDOW_MS) {
        ipRateLimits.delete(key);
      }
    }
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
    console.error('Error fetching headlines from NewsAPI', {
      message: error.message,
      name: error.name,
      stack: error.stack,
      url
    });

    res.status(500).json({ error: 'Failed to fetch headlines from NewsAPI.' });
  }
});

app.all('/api/*', (req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`News dashboard server running at http://localhost:${port}`);
});

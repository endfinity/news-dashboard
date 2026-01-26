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

app.get('/api/headlines', async (req, res) => {
  if (!NEWSAPI_KEY) {
    res.status(500).json({ error: 'NEWSAPI_KEY is not configured on the server.' });
    return;
  }

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
    const response = await fetch(url, {
      headers: {
        'X-Api-Key': NEWSAPI_KEY
      }
    });

    if (!response.ok) {
      const errorBody = await response.text();
      res.status(response.status).json({ error: 'News API request failed', details: errorBody });
      return;
    }

    const data = await response.json();
    res.json({
      status: data.status,
      totalResults: data.totalResults,
      articles: data.articles || [],
      page,
      pageSize
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error fetching headlines from NewsAPI', error);
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

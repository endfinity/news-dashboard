// @vitest-environment node
import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/server.js';

describe('Server API Tests', () => {
  it('should return 500 status when NEWSAPI_KEY is missing', async () => {
    // Store original environment variable
    const originalKey = process.env.NEWSAPI_KEY;

    // Clear it for the test
    delete process.env.NEWSAPI_KEY;

    try {
      const response = await request(app).get('/api/headlines');
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'NEWSAPI_KEY is not configured on the server.' });
    } finally {
      // Restore the environment variable after the test
      if (originalKey !== undefined) {
        process.env.NEWSAPI_KEY = originalKey;
      }
    }
  });

  afterAll(() => {
    if (app.closeCleanupInterval) {
      app.closeCleanupInterval();
    }
  });
});

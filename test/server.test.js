import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

// Global variable to keep reference to the dynamically loaded app
let app;

test('missing NEWSAPI_KEY should return 500 status', async (t) => {
  // Store original environment variable
  const originalKey = process.env.NEWSAPI_KEY;

  // Clear it for the test before loading the server
  delete process.env.NEWSAPI_KEY;

  try {
    // Dynamically import the app after clearing the environment variable
    // We add a cache buster parameter to ensure we get a fresh instance
    // though ES modules generally cache, Node's behavior might vary.
    // To be perfectly safe against module caching we can use a query string
    // or just rely on the fact that this test runs first in the suite and we haven't imported it yet.
    const module = await import(`../src/server.js?v=${Date.now()}`);
    app = module.default;

    const response = await request(app).get('/api/headlines');

    assert.strictEqual(response.status, 500, 'Expected status code 500');
    assert.deepStrictEqual(response.body, { error: 'NEWSAPI_KEY is not configured on the server.' }, 'Expected error JSON response');
  } finally {
    // Restore the environment variable after the test
    if (originalKey !== undefined) {
      process.env.NEWSAPI_KEY = originalKey;
    }
  }
});

after(() => {
  // Clear the setInterval in the server to allow the process to exit
  if (app && app.closeCleanupInterval) {
    app.closeCleanupInterval();
  }
});

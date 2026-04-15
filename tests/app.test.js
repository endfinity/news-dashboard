import { describe, it, expect, beforeEach } from 'vitest';

// Import app.js to execute it and attach methods to window
import '../public/app.js';

describe('isArticleSaved', () => {
  beforeEach(() => {
    // Reset savedArticles state before each test
    window._setSavedArticlesForTesting([]);
  });

  it('should return true if the article is saved', () => {
    const testArticle = { url: 'https://example.com/article1', title: 'Test Article 1' };
    window._setSavedArticlesForTesting([
      { url: 'https://example.com/other', title: 'Other Article' },
      testArticle,
    ]);

    expect(window.isArticleSaved(testArticle)).toBe(true);
  });

  it('should return false if the article is not saved', () => {
    const testArticle = { url: 'https://example.com/article2', title: 'Test Article 2' };
    window._setSavedArticlesForTesting([
      { url: 'https://example.com/article1', title: 'Test Article 1' },
    ]);

    expect(window.isArticleSaved(testArticle)).toBe(false);
  });

  it('should return false if savedArticles is empty', () => {
    const testArticle = { url: 'https://example.com/article3', title: 'Test Article 3' };

    expect(window.isArticleSaved(testArticle)).toBe(false);
  });

  it('should handle undefined article properties gracefully if matched against empty/non-matching urls', () => {
     window._setSavedArticlesForTesting([
       { url: 'https://example.com/article1' }
     ]);

     // Assuming a malformed article without URL is passed (though technically the logic uses .some and expects .url)
     expect(window.isArticleSaved({})).toBe(false);
  });
});

describe('getArticleSourceName', () => {
  it('should return the source name if it exists', () => {
    const article = { source: { name: 'The New York Times' } };
    expect(window.getArticleSourceName(article)).toBe('The New York Times');
  });

  it('should return "Unknown source" if source is undefined', () => {
    const article = {};
    expect(window.getArticleSourceName(article)).toBe('Unknown source');
  });

  it('should return "Unknown source" if source.name is undefined', () => {
    const article = { source: {} };
    expect(window.getArticleSourceName(article)).toBe('Unknown source');
  });

  it('should return "Unknown source" if source is null', () => {
    const article = { source: null };
    expect(window.getArticleSourceName(article)).toBe('Unknown source');
  });
});

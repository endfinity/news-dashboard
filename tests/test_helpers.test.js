import { describe, it, expect } from 'vitest';
import '../public/app.js';

describe('getArticleSourceName', () => {
  it('should return source name if available', () => {
    const article = { source: { name: 'BBC News' } };
    const sourceName = window.getArticleSourceName(article);
    expect(sourceName).toBe('BBC News');
  });

  it('should return Unknown source if source is missing', () => {
    const article = { title: 'Test' };
    const sourceName = window.getArticleSourceName(article);
    expect(sourceName).toBe('Unknown source');
  });

  it('should return custom default if provided and source is missing', () => {
    const article = { title: 'Test' };
    const sourceName = window.getArticleSourceName(article, '');
    expect(sourceName).toBe('');
  });
});

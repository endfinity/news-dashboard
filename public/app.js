const categoryButtons = document.querySelectorAll('.category-button');
const articlesContainer = document.getElementById('articles');
const statusEl = document.getElementById('status');
const categoryTitleEl = document.getElementById('current-category-title');
const articleCountEl = document.getElementById('article-count');
const categoryBadgeEl = document.getElementById('category-badge');
const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');
const sourceFilterEl = document.getElementById('source-filter');
const loadMoreButton = document.getElementById('load-more');
const majorUsToggle = document.getElementById('major-us-toggle');
const menuToggleButton = document.getElementById('menu-toggle');
const timeFilterButtons = document.querySelectorAll('.time-filter-button');

const CATEGORY_TITLES = {
  general: 'Top Stories',
  business: 'Business',
  technology: 'Technology',
  health: 'Health',
  science: 'Science',
  sports: 'Sports',
  entertainment: 'Entertainment',
  saved: 'Saved articles'
};

const uiState = {
  currentCategory: 'general',
  currentPage: 1,
  pageSize: 12,
  currentQuery: '',
  currentArticles: [],
  totalResults: 0,
  currentSourceFilter: 'all',
  usMajorOnly: false,
  timeFilter: 'all'
};

function isSavedViewActive() {
  return uiState.currentCategory === 'saved';
}

const STORAGE_KEY = 'news-dashboard.saved-articles';
const LAST_CATEGORY_KEY = 'news-dashboard.last-category';

function safeLocalStorageGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    console.error(`Failed to get item from storage for key: ${key}`, error);
    return null;
  }
}

function safeLocalStorageSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    console.error(`Failed to set item in storage for key: ${key}`, error);
  }
}

const MAJOR_US_SOURCES = [
  'CNN',
  'Fox News',
  'The New York Times',
  'The Washington Post',
  'The Wall Street Journal',
  'ABC News',
  'CBS News',
  'NBC News',
  'USA Today',
  'Reuters',
  'Associated Press'
].map((name) => name.toLowerCase());

function loadSavedArticles() {
  const raw = safeLocalStorageGet(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (error) {
    console.error('Failed to parse saved articles from storage', error);
    return [];
  }
}

let savedArticles = loadSavedArticles();
let savedArticleUrls = new Set(savedArticles.map((a) => a.url));

function persistSavedArticles() {
  safeLocalStorageSet(STORAGE_KEY, JSON.stringify(savedArticles));
}

function loadLastCategory() {
  const value = safeLocalStorageGet(LAST_CATEGORY_KEY);
  if (!value) return 'general';
  if (CATEGORY_TITLES[value] || value === 'saved') {
    return value;
  }
  return 'general';
}

function persistLastCategory(category) {
  safeLocalStorageSet(LAST_CATEGORY_KEY, category);
}

function isArticleSaved(article) {
  return savedArticleUrls.has(article.url);
}

function updateMenuToggleIcon() {
  if (!menuToggleButton) return;
  const isOpen = document.body.classList.contains('sidebar-open');
  menuToggleButton.textContent = isOpen ? '<<' : '>>';
}

function showToast(message) {
  const existing = document.querySelector('.toast-message');
  if (existing) {
    existing.remove();
  }

  const toast = document.createElement('div');
  toast.className = 'toast-message';
  toast.textContent = message;

  document.body.appendChild(toast);

  // Trigger transition
  requestAnimationFrame(() => {
    toast.classList.add('toast-message-visible');
  });

  setTimeout(() => {
    toast.classList.remove('toast-message-visible');
  }, 2600);

  setTimeout(() => {
    toast.remove();
  }, 3200);
}

function setStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = `status status-${type}`;
}

function clearStatus() {
  statusEl.textContent = '';
  statusEl.className = 'status status-hidden';
}

function setActiveCategoryButton(category) {
  categoryButtons.forEach((btn) => {
    const isActive = btn.dataset.category === category;
    btn.classList.toggle('active', isActive);
  });

  categoryTitleEl.textContent = CATEGORY_TITLES[category] || 'News';

  if (categoryBadgeEl) {
    const label = CATEGORY_TITLES[category] || 'News';
    categoryBadgeEl.textContent = label;

    categoryBadgeEl.className = 'category-badge';
    categoryBadgeEl.classList.add(`category-badge-${category}`);
  }
}

function closeSidebarForMobile() {
  if (window.innerWidth <= 768) {
    document.body.classList.remove('sidebar-open');
    updateMenuToggleIcon();
  }
}

function switchToCategory(category) {
  if (!category) return;

  if (!CATEGORY_TITLES[category] && category !== 'saved') {
    category = 'general';
  }

  uiState.currentCategory = category;
  uiState.currentPage = 1;
  uiState.currentQuery = '';
  uiState.currentSourceFilter = 'all';
  searchInput.value = '';
  sourceFilterEl.value = 'all';
  uiState.usMajorOnly = false;
  majorUsToggle.checked = false;

  persistLastCategory(category);

  setActiveCategoryButton(category);
  fetchHeadlines(category, { resetPage: true });
  closeSidebarForMobile();

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

const createQueryFilter = (query) => {
  const q = query.toLowerCase();
  return (article) => {
    const title = (article.title || '').toLowerCase();
    const description = (article.description || '').toLowerCase();
    return title.includes(q) || description.includes(q);
  };
};

const createSourceFilter = (filterName) => {
  return (article) => {
    const sourceName = article.source && article.source.name ? article.source.name : 'Unknown source';
    return sourceName === filterName;
  };
};

const createMajorUsFilter = () => {
  return (article) => {
    const sourceName = article.source && article.source.name ? article.source.name : '';
    return MAJOR_US_SOURCES.includes(sourceName.toLowerCase());
  };
};

const createTimeFilter = (timeFilter) => {
  const nowTime = Date.now();
  let cutoff = 0;

  if (timeFilter === '24h') {
    cutoff = nowTime - 24 * 60 * 60 * 1000;
  } else if (timeFilter === '7d') {
    cutoff = nowTime - 7 * 24 * 60 * 60 * 1000;
  }

  if (cutoff <= 0) return null;

  return (article) => {
    if (!article.publishedAt) return false;
    const publishedDate = new Date(article.publishedAt);
    if (Number.isNaN(publishedDate.getTime())) return false;
    return publishedDate.getTime() >= cutoff;
  };
};

function getVisibleArticles(baseArticles) {
  const activeFilters = [];

  if (isSavedViewActive() && uiState.currentQuery) {
    activeFilters.push(createQueryFilter(uiState.currentQuery));
  }

  if (uiState.currentSourceFilter !== 'all') {
    activeFilters.push(createSourceFilter(uiState.currentSourceFilter));
  }

  if (uiState.usMajorOnly) {
    activeFilters.push(createMajorUsFilter());
  }

  if (uiState.timeFilter !== 'all') {
    const timeFilterFn = createTimeFilter(uiState.timeFilter);
    if (timeFilterFn) {
      activeFilters.push(timeFilterFn);
    }
  }

  if (activeFilters.length === 0) {
    return baseArticles;
  }

  return baseArticles.filter((article) => activeFilters.every((fn) => fn(article)));
}

function renderSkeletons() {
  const placeholderCount = 4;
  articlesContainer.innerHTML = '';

  const fragment = document.createDocumentFragment();

  for (let index = 0; index < placeholderCount; index += 1) {
    const card = document.createElement('article');
    card.className = 'article-card article-card-skeleton';
    card.innerHTML = `
      <div class="article-image-wrapper skeleton-block"></div>
      <div class="article-body">
        <div class="skeleton-line skeleton-line-title"></div>
        <div class="skeleton-line skeleton-line-meta"></div>
        <div class="skeleton-line skeleton-line-body"></div>
        <div class="skeleton-line skeleton-line-body"></div>
      </div>
    `;
    fragment.appendChild(card);
  }

  articlesContainer.appendChild(fragment);
}

function updateSourceFilterOptions(articles) {
  const uniqueSources = new Set();

  articles.forEach((article) => {
    const sourceName = article.source && article.source.name ? article.source.name : 'Unknown source';
    uniqueSources.add(sourceName);
  });

  const previousValue = sourceFilterEl.value || 'all';

  sourceFilterEl.innerHTML = '';

  const allOption = document.createElement('option');
  allOption.value = 'all';
  allOption.textContent = 'All sources';
  sourceFilterEl.appendChild(allOption);

  const uniqueSourcesArray = Array.from(uniqueSources);

  uniqueSourcesArray
    .sort()
    .forEach((name) => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      sourceFilterEl.appendChild(option);
    });

  if (uniqueSources.has(previousValue)) {
    sourceFilterEl.value = previousValue;
    uiState.currentSourceFilter = previousValue;
  } else {
    sourceFilterEl.value = 'all';
    uiState.currentSourceFilter = 'all';
  }
}

function updateLoadMoreVisibility() {
  // Use helper function isSavedViewActive() instead of manual uiState.currentCategory === 'saved' check to centralize logic
  if (isSavedViewActive()) {
    loadMoreButton.classList.add('load-more-hidden');
    return;
  }

  if (!uiState.totalResults || uiState.currentArticles.length >= uiState.totalResults) {
    loadMoreButton.classList.add('load-more-hidden');
  } else {
    loadMoreButton.classList.remove('load-more-hidden');
  }
}

function renderArticles(articles, { isSavedView = false } = {}) {
  if (!isSavedView) {
    uiState.currentArticles = articles;
  }

  const baseArticles = isSavedView ? articles : uiState.currentArticles;
  const visibleArticles = getVisibleArticles(baseArticles);

  articlesContainer.innerHTML = '';

  if (!visibleArticles.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent =
      isSavedViewActive()
        ? 'You have no saved articles yet.'
        : 'No articles found for this selection right now.';
    articlesContainer.appendChild(empty);
    articleCountEl.textContent = '0 articles';
    return;
  }

  const fragment = document.createDocumentFragment();

  visibleArticles.forEach((article) => {
    const card = document.createElement('article');
    card.className = 'article-card';

    const imageUrl = article.urlToImage || '';
    const sourceName = article.source && article.source.name ? article.source.name : 'Unknown source';
    const saved = isArticleSaved(article);

    card.innerHTML = `
      ${
        imageUrl
          ? `<div class="article-image-wrapper"><img src="${imageUrl}" alt="${
              article.title || 'Article image'
            }" class="article-image" loading="lazy" /></div>`
          : ''
      }
      <div class="article-body">
        <div class="article-header-row">
          <h3 class="article-title">${article.title || 'Untitled'}</h3>
          <button
            type="button"
            class="article-save-toggle ${saved ? 'article-save-toggle-saved' : ''}"
            data-role="save-toggle"
            data-article-url="${article.url}"
            aria-label="${saved ? 'Remove from saved' : 'Save article'}"
          >
            ★
          </button>
        </div>
        <p class="article-meta">
          <span>${sourceName}</span>
          ${
            article.publishedAt
              ? ` <span class="article-meta-separator">·</span> <time>${new Date(
                  article.publishedAt
                ).toLocaleString()}</time>`
              : ''
          }
        </p>
        ${article.description ? `<p class="article-description">${article.description}</p>` : ''}
        <a href="${article.url}" target="_blank" rel="noopener noreferrer" class="article-link">Read full story</a>
      </div>
    `;

    fragment.appendChild(card);
  });

  articlesContainer.appendChild(fragment);
  articleCountEl.textContent = `${visibleArticles.length} article${
    visibleArticles.length === 1 ? '' : 's'
  }`;
}

async function fetchHeadlines(category, { append = false, resetPage = false } = {}) {
  if (category === 'saved') {
    clearStatus();
    renderArticles(savedArticles, { isSavedView: true });
    updateSourceFilterOptions(savedArticles);
    uiState.totalResults = savedArticles.length;
    updateLoadMoreVisibility();
    return;
  }

  if (resetPage) {
    uiState.currentPage = 1;
  }

  setStatus(`Loading ${CATEGORY_TITLES[category] || 'news'}...`, 'loading');

  if (resetPage) {
    renderSkeletons();
  }

  const params = new URLSearchParams({
    category,
    page: String(uiState.currentPage),
    pageSize: String(uiState.pageSize)
  });

  if (uiState.currentQuery) {
    params.set('q', uiState.currentQuery);
  }

  try {
    const response = await fetch(`/api/headlines?${params.toString()}`);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Request failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const articles = data.articles || [];

    let combined;
    if (append) {
      const existingUrls = new Set(uiState.currentArticles.map((item) => item.url));
      const newUniqueArticles = articles.filter((article) => article && !existingUrls.has(article.url));

      combined = [...uiState.currentArticles, ...newUniqueArticles];
    } else {
      combined = articles;
    }

    uiState.totalResults = typeof data.totalResults === 'number' ? data.totalResults : combined.length;

    if (append && combined.length === uiState.currentArticles.length) {
      // No new unique articles were added
      clearStatus();
      showToast('All available headlines have been loaded for now.');
      loadMoreButton.classList.add('load-more-hidden');
      return;
    }

    clearStatus();
    renderArticles(combined);
    updateSourceFilterOptions(combined);
    updateLoadMoreVisibility();
  } catch (error) {
    console.error(error);
    setStatus('Failed to load news. Please try again later.', 'error');
    if (resetPage) {
      articlesContainer.innerHTML = '';
      articleCountEl.textContent = '';
    }
    updateLoadMoreVisibility();
  }
}

function refreshCurrentView() {
  if (isSavedViewActive()) {
    renderArticles(savedArticles, { isSavedView: true });
    updateSourceFilterOptions(savedArticles);
    uiState.totalResults = savedArticles.length;
    updateLoadMoreVisibility();
  } else {
    renderArticles(uiState.currentArticles);
    updateSourceFilterOptions(uiState.currentArticles);
    updateLoadMoreVisibility();
  }
}

function toggleSavedArticle(article) {
  if (!article || !article.url) return;

  if (isArticleSaved(article)) {
    savedArticles = savedArticles.filter((saved) => saved.url !== article.url);
    savedArticleUrls.delete(article.url);
  } else {
    savedArticles = [...savedArticles, article];
    savedArticleUrls.add(article.url);
  }

  persistSavedArticles();
  refreshCurrentView();
}

categoryButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const category = button.dataset.category;
    if (!category) return;

    switchToCategory(category);
  });
});

searchForm.addEventListener('submit', (event) => {
  event.preventDefault();
  uiState.currentQuery = (searchInput.value || '').trim();
  uiState.currentPage = 1;

  if (isSavedViewActive()) {
    refreshCurrentView();
  } else {
    fetchHeadlines(uiState.currentCategory, { resetPage: true });
  }
});

sourceFilterEl.addEventListener('change', () => {
  uiState.currentSourceFilter = sourceFilterEl.value || 'all';
  refreshCurrentView();
});

loadMoreButton.addEventListener('click', () => {
  if (isSavedViewActive()) {
    return;
  }

  uiState.currentPage += 1;
  fetchHeadlines(uiState.currentCategory, { append: true });
});

menuToggleButton.addEventListener('click', () => {
  document.body.classList.toggle('sidebar-open');
  updateMenuToggleIcon();
});

majorUsToggle.addEventListener('change', () => {
  uiState.usMajorOnly = majorUsToggle.checked;
  refreshCurrentView();
});

timeFilterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const value = button.dataset.timeFilter || 'all';
    uiState.timeFilter = value;

    timeFilterButtons.forEach((btn) => {
      btn.classList.toggle('time-filter-button-active', btn === button);
    });

    refreshCurrentView();
  });
});

articlesContainer.addEventListener('click', (event) => {
  const toggleButton = event.target.closest('[data-role="save-toggle"]');
  if (!toggleButton) return;

  const articleUrl = toggleButton.getAttribute('data-article-url');
  if (!articleUrl) return;

  const pool = isSavedViewActive() ? savedArticles : uiState.currentArticles;
  const article = pool.find((item) => item.url === articleUrl);

  if (article) {
    toggleSavedArticle(article);
  }
});

// Keyboard shortcuts & initial load
document.addEventListener('keydown', (event) => {
  const activeElement = document.activeElement;
  const tag = activeElement && activeElement.tagName ? activeElement.tagName.toLowerCase() : '';
  const isTyping = tag === 'input' || tag === 'textarea';

  if (event.key === '/' && !isTyping) {
    event.preventDefault();
    searchInput.focus();
    return;
  }

  if (isTyping) {
    if (event.key === 'Escape' && activeElement === searchInput) {
      searchInput.blur();
    }
    return;
  }

  switch (event.key) {
    case '1':
      switchToCategory('general');
      break;
    case '2':
      switchToCategory('business');
      break;
    case '3':
      switchToCategory('technology');
      break;
    case '4':
      switchToCategory('health');
      break;
    case '5':
      switchToCategory('science');
      break;
    case '6':
      switchToCategory('sports');
      break;
    case '7':
      switchToCategory('entertainment');
      break;
    case '8':
      switchToCategory('saved');
      break;
    default:
  }
});

const initialCategory = loadLastCategory();

if (window.innerWidth > 768) {
  document.body.classList.add('sidebar-open');
}

updateMenuToggleIcon();

setActiveCategoryButton(initialCategory);
fetchHeadlines(initialCategory, { resetPage: true });

// Test exports attached to window
if (typeof window !== 'undefined' && window.process && window.process.env && window.process.env.NODE_ENV === 'test') {
  window._setSavedArticlesForTesting = (articles) => {
    savedArticles = articles;
    savedArticleUrls = new Set(savedArticles.map((a) => a.url));
  };
  window.isArticleSaved = isArticleSaved;
}

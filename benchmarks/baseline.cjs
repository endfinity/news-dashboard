const { performance } = require('perf_hooks');

console.log("Running memory leak benchmark...\n");

function runMapBenchmark() {
  const startMem = process.memoryUsage().heapUsed;
  const startTime = performance.now();
  const map = new Map();
  for (let i = 0; i < 500000; i++) {
    map.set(i, { payload: `data-${i}`, expiresAt: Date.now() + 60000 });
  }
  const endTime = performance.now();
  const endMem = process.memoryUsage().heapUsed;

  return {
    time: endTime - startTime,
    memoryIncreaseMB: (endMem - startMem) / 1024 / 1024,
    size: map.size
  };
}

class LRUCache {
  constructor(maxSize) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key) {
    const value = this.cache.get(key);
    if (value === undefined) return undefined;
    // LRU: Move to back
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  get size() { return this.cache.size; }
  entries() { return this.cache.entries(); }
  delete(key) { return this.cache.delete(key); }
}

function runLRUBenchmark() {
  const startMem = process.memoryUsage().heapUsed;
  const startTime = performance.now();
  const lru = new LRUCache(1000);
  for (let i = 0; i < 500000; i++) {
    lru.set(i, { payload: `data-${i}`, expiresAt: Date.now() + 60000 });
  }
  const endTime = performance.now();
  const endMem = process.memoryUsage().heapUsed;

  return {
    time: endTime - startTime,
    memoryIncreaseMB: (endMem - startMem) / 1024 / 1024,
    size: lru.size
  };
}

const mapResult = runMapBenchmark();
console.log(`Baseline Unbounded Map:`);
console.log(`- Time: ${mapResult.time.toFixed(2)} ms`);
console.log(`- Memory Increase: ${mapResult.memoryIncreaseMB.toFixed(2)} MB`);
console.log(`- Final Size: ${mapResult.size} items\n`);

// Garbage collect if possible (run with node --expose-gc)
if (global.gc) { global.gc(); }

const lruResult = runLRUBenchmark();
console.log(`Optimized LRU Cache (maxSize: 1000):`);
console.log(`- Time: ${lruResult.time.toFixed(2)} ms`);
console.log(`- Memory Increase: ${lruResult.memoryIncreaseMB.toFixed(2)} MB`);
console.log(`- Final Size: ${lruResult.size} items\n`);

console.log(`Improvement: Memory leak prevented (saved ~${(mapResult.memoryIncreaseMB - lruResult.memoryIncreaseMB).toFixed(2)} MB in 500k requests).`);

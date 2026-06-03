const NodeCache = require('node-cache');

// stdTTL: default seconds, checkperiod: cleanup interval
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

const TTL = {
  DASHBOARD: 300,    // 5 min
  PROPERTIES: 300,   // 5 min
  LEADERBOARD: 3600, // 1 hour
  PROFILES: 1800,    // 30 min
  ANALYTICS: 600,    // 10 min
};

function get(key) {
  return cache.get(key);
}

function set(key, value, ttl) {
  cache.set(key, value, ttl);
}

function del(key) {
  cache.del(key);
}

function invalidatePattern(prefix) {
  const keys = cache.keys().filter(k => k.startsWith(prefix));
  keys.forEach(k => cache.del(k));
}

module.exports = { get, set, del, invalidatePattern, TTL };

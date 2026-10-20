-- Visit counts for ethannju.github.io (see worker.js)
CREATE TABLE IF NOT EXISTS totals (k TEXT PRIMARY KEY, v INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS countries (code TEXT PRIMARY KEY, n INTEGER NOT NULL);
-- one row per 1° cell of latitude/longitude
CREATE TABLE IF NOT EXISTS places (lat INTEGER NOT NULL, lon INTEGER NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (lat, lon));
-- salted hashes of recent visitors, kept 30 minutes so a reload isn't a new visit
CREATE TABLE IF NOT EXISTS recent (h TEXT PRIMARY KEY, at INTEGER NOT NULL);

/**
 * SQLite WASM Wrapper for Client-Side Translation Memory
 * Handles millions of TM entries with sub-millisecond queries
 */

class SQLiteWrapper {
    constructor(dbPath) {
        this.dbPath = dbPath;
        this.db = null;
        this.isInitialized = false;
        this.cache = new Map();
        this.preparedStatements = new Map();
    }

    async init() {
        if (this.isInitialized) return;

        try {
            // Load SQLite WASM
            const sqliteModule = await import('/lib/sqlite3.wasm.js');
            const sqlite3 = await sqliteModule.default();
            
            // Open or create database
            this.db = new sqlite3.oo1.DB(this.dbPath);
            
            // Initialize schema
            await this.initializeSchema();
            
            // Prepare common statements
            await this.prepareStatements();
            
            // Optimize for performance
            await this.optimizeDatabase();
            
            this.isInitialized = true;
            console.log('SQLite initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize SQLite:', error);
            throw error;
        }
    }

    async initializeSchema() {
        const schema = `
            -- Translation Memory table with optimized indexes
            CREATE TABLE IF NOT EXISTS translation_memory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_hash TEXT NOT NULL,
                source_text TEXT NOT NULL,
                target_text TEXT NOT NULL,
                source_locale TEXT NOT NULL,
                target_locale TEXT NOT NULL,
                score REAL DEFAULT 1.0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER DEFAULT NULL,
                project_id TEXT DEFAULT NULL,
                domain TEXT DEFAULT NULL
            );

            -- Optimized indexes for fast lookups
            CREATE INDEX IF NOT EXISTS idx_tm_hash_locale 
                ON translation_memory(source_hash, source_locale, target_locale);
            CREATE INDEX IF NOT EXISTS idx_tm_text_lookup 
                ON translation_memory(source_text, source_locale, target_locale);
            CREATE INDEX IF NOT EXISTS idx_tm_score 
                ON translation_memory(score DESC);
            CREATE INDEX IF NOT EXISTS idx_tm_created 
                ON translation_memory(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_tm_project 
                ON translation_memory(project_id, domain);

            -- Full-text search for fuzzy matching
            CREATE VIRTUAL TABLE IF NOT EXISTS tm_fts USING fts5(
                source_text, 
                target_text, 
                content='translation_memory', 
                content_rowid='id'
            );

            -- Triggers to maintain FTS
            CREATE TRIGGER IF NOT EXISTS tm_fts_insert AFTER INSERT ON translation_memory 
            BEGIN
                INSERT INTO tm_fts(rowid, source_text, target_text) 
                VALUES (new.id, new.source_text, new.target_text);
            END;

            CREATE TRIGGER IF NOT EXISTS tm_fts_delete AFTER DELETE ON translation_memory 
            BEGIN
                INSERT INTO tm_fts(tm_fts, rowid, source_text, target_text) 
                VALUES('delete', old.id, old.source_text, old.target_text);
            END;

            -- Performance statistics table
            CREATE TABLE IF NOT EXISTS performance_stats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                query_type TEXT NOT NULL,
                execution_time REAL NOT NULL,
                rows_affected INTEGER DEFAULT 0,
                timestamp INTEGER NOT NULL
            );

            -- Cache table for frequently accessed data
            CREATE TABLE IF NOT EXISTS query_cache (
                cache_key TEXT PRIMARY KEY,
                result_data TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                expires_at INTEGER NOT NULL
            );
        `;

        await this.execute(schema);
    }

    async prepareStatements() {
        const statements = {
            // TM lookup queries
            findExactMatch: `
                SELECT target_text, score, created_at 
                FROM translation_memory 
                WHERE source_hash = ? AND source_locale = ? AND target_locale = ?
                ORDER BY score DESC, created_at DESC
                LIMIT 1
            `,
            
            findFuzzyMatches: `
                SELECT 
                    tm.target_text, 
                    tm.source_text,
                    tm.score,
                    tm.created_at,
                    fts.rank
                FROM translation_memory tm
                JOIN tm_fts fts ON tm.id = fts.rowid
                WHERE tm.source_locale = ? AND tm.target_locale = ?
                AND tm_fts MATCH ?
                ORDER BY fts.rank, tm.score DESC
                LIMIT ?
            `,
            
            insertTM: `
                INSERT OR REPLACE INTO translation_memory 
                (source_hash, source_text, target_text, source_locale, target_locale, score, created_at, project_id, domain)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            
            updateTMScore: `
                UPDATE translation_memory 
                SET score = ?, updated_at = ?
                WHERE source_hash = ? AND source_locale = ? AND target_locale = ?
            `,
            
            getStats: `
                SELECT 
                    COUNT(*) as total_entries,
                    COUNT(DISTINCT source_locale || '-' || target_locale) as language_pairs,
                    AVG(score) as avg_score,
                    MAX(created_at) as last_update
                FROM translation_memory
            `
        };

        for (const [name, sql] of Object.entries(statements)) {
            this.preparedStatements.set(name, this.db.prepare(sql));
        }
    }

    async optimizeDatabase() {
        // Performance optimizations
        const optimizations = [
            'PRAGMA journal_mode = WAL',      // Write-Ahead Logging for better concurrency
            'PRAGMA synchronous = NORMAL',    // Balance between safety and speed
            'PRAGMA cache_size = -64000',     // 64MB cache
            'PRAGMA temp_store = MEMORY',     // Use memory for temporary tables
            'PRAGMA mmap_size = 268435456',   // 256MB memory-mapped I/O
            'PRAGMA optimize'                 // Analyze and optimize
        ];

        for (const pragma of optimizations) {
            await this.execute(pragma);
        }
    }

    async execute(sql, params = []) {
        const startTime = performance.now();
        
        try {
            let result;
            
            if (params.length > 0) {
                const stmt = this.db.prepare(sql);
                if (sql.trim().toUpperCase().startsWith('SELECT')) {
                    result = stmt.get(params);
                } else {
                    result = stmt.run(params);
                }
                stmt.finalize();
            } else {
                result = this.db.exec(sql);
            }
            
            const executionTime = performance.now() - startTime;
            
            // Log performance for optimization
            if (executionTime > 10) { // Log slow queries
                console.warn(`Slow query (${executionTime.toFixed(2)}ms): ${sql.substring(0, 100)}...`);
            }
            
            // Record stats
            this.recordPerformanceStats(sql, executionTime, result?.changes || 0);
            
            return result;
            
        } catch (error) {
            console.error('SQLite execution error:', error, 'SQL:', sql);
            throw error;
        }
    }

    async findTranslationMatches(sourceText, sourceLocale, targetLocale, limit = 10) {
        const cacheKey = `tm:${sourceText}:${sourceLocale}:${targetLocale}:${limit}`;
        
        // Check cache first
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        const sourceHash = this.generateHash(sourceText);
        
        // Try exact match first
        const exactStmt = this.preparedStatements.get('findExactMatch');
        const exactMatch = exactStmt.get([sourceHash, sourceLocale, targetLocale]);
        
        if (exactMatch && exactMatch.score > 0.95) {
            const result = [{ ...exactMatch, score: 1.0, type: 'exact' }];
            this.cache.set(cacheKey, result);
            return result;
        }

        // Fuzzy matching using FTS
        const fuzzyStmt = this.preparedStatements.get('findFuzzyMatches');
        const searchQuery = this.buildFTSQuery(sourceText);
        const fuzzyMatches = fuzzyStmt.all([sourceLocale, targetLocale, searchQuery, limit]);
        
        // Calculate similarity scores
        const scoredMatches = fuzzyMatches.map(match => ({
            ...match,
            score: this.calculateSimilarity(sourceText, match.source_text),
            type: 'fuzzy'
        })).filter(match => match.score > 0.5);

        // Combine exact and fuzzy matches
        const allMatches = exactMatch ? [exactMatch, ...scoredMatches] : scoredMatches;
        
        // Sort by score and limit results
        const result = allMatches
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);

        // Cache result
        this.cache.set(cacheKey, result);
        this.limitCacheSize();

        return result;
    }

    async storeTM(sourceText, targetText, sourceLocale, targetLocale, options = {}) {
        const sourceHash = this.generateHash(sourceText);
        const timestamp = Date.now();
        
        const params = [
            sourceHash,
            sourceText,
            targetText,
            sourceLocale,
            targetLocale,
            options.score || 1.0,
            timestamp,
            options.projectId || null,
            options.domain || null
        ];

        const stmt = this.preparedStatements.get('insertTM');
        const result = stmt.run(params);
        
        // Invalidate related cache entries
        this.invalidateCache(`tm:${sourceText}:`);
        
        return result;
    }

    async updateTMScore(sourceText, sourceLocale, targetLocale, newScore) {
        const sourceHash = this.generateHash(sourceText);
        const timestamp = Date.now();
        
        const stmt = this.preparedStatements.get('updateTMScore');
        const result = stmt.run([newScore, timestamp, sourceHash, sourceLocale, targetLocale]);
        
        // Invalidate cache
        this.invalidateCache(`tm:${sourceText}:`);
        
        return result;
    }

    buildFTSQuery(text) {
        // Convert text to FTS query
        const words = text.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2)
            .slice(0, 10); // Limit to 10 words for performance
        
        return words.map(word => `"${word}"`).join(' OR ');
    }

    calculateSimilarity(text1, text2) {
        // Optimized similarity calculation
        if (text1 === text2) return 1.0;
        
        const len1 = text1.length;
        const len2 = text2.length;
        
        if (Math.abs(len1 - len2) > Math.max(len1, len2) * 0.5) {
            return 0; // Too different in length
        }
        
        // Use Jaro-Winkler for better performance
        return this.jaroWinkler(text1.toLowerCase(), text2.toLowerCase());
    }

    jaroWinkler(s1, s2) {
        const jaro = this.jaro(s1, s2);
        if (jaro < 0.7) return jaro;
        
        // Calculate common prefix length (up to 4 characters)
        let prefixLength = 0;
        for (let i = 0; i < Math.min(s1.length, s2.length, 4); i++) {
            if (s1[i] === s2[i]) {
                prefixLength++;
            } else {
                break;
            }
        }
        
        return jaro + (0.1 * prefixLength * (1 - jaro));
    }

    jaro(s1, s2) {
        if (s1 === s2) return 1.0;
        
        const len1 = s1.length;
        const len2 = s2.length;
        
        if (len1 === 0 || len2 === 0) return 0.0;
        
        const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;
        if (matchWindow < 0) return 0.0;
        
        const s1Matches = new Array(len1).fill(false);
        const s2Matches = new Array(len2).fill(false);
        
        let matches = 0;
        let transpositions = 0;
        
        // Identify matches
        for (let i = 0; i < len1; i++) {
            const start = Math.max(0, i - matchWindow);
            const end = Math.min(i + matchWindow + 1, len2);
            
            for (let j = start; j < end; j++) {
                if (s2Matches[j] || s1[i] !== s2[j]) continue;
                s1Matches[i] = s2Matches[j] = true;
                matches++;
                break;
            }
        }
        
        if (matches === 0) return 0.0;
        
        // Count transpositions
        let k = 0;
        for (let i = 0; i < len1; i++) {
            if (!s1Matches[i]) continue;
            while (!s2Matches[k]) k++;
            if (s1[i] !== s2[k]) transpositions++;
            k++;
        }
        
        return (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3.0;
    }

    generateHash(text) {
        // Fast hash function for TM keys
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(36);
    }

    recordPerformanceStats(sql, executionTime, rowsAffected) {
        // Async performance logging (don't block main thread)
        setTimeout(() => {
            const queryType = sql.trim().split(' ')[0].toUpperCase();
            this.execute(
                'INSERT INTO performance_stats (query_type, execution_time, rows_affected, timestamp) VALUES (?, ?, ?, ?)',
                [queryType, executionTime, rowsAffected, Date.now()]
            ).catch(err => console.warn('Failed to log performance stats:', err));
        }, 0);
    }

    invalidateCache(prefix) {
        for (const key of this.cache.keys()) {
            if (key.startsWith(prefix)) {
                this.cache.delete(key);
            }
        }
    }

    limitCacheSize() {
        const maxSize = 1000;
        if (this.cache.size > maxSize) {
            const keysToDelete = Array.from(this.cache.keys()).slice(0, this.cache.size - maxSize);
            keysToDelete.forEach(key => this.cache.delete(key));
        }
    }

    async getStats() {
        const stmt = this.preparedStatements.get('getStats');
        const dbStats = stmt.get();
        
        return {
            ...dbStats,
            cacheSize: this.cache.size,
            preparedStatements: this.preparedStatements.size,
            memoryUsage: this.db.exec('PRAGMA page_count * PRAGMA page_size')[0]?.values?.[0] || 0
        };
    }

    async vacuum() {
        // Optimize database storage
        await this.execute('VACUUM');
        await this.execute('PRAGMA optimize');
    }

    close() {
        if (this.db) {
            // Finalize prepared statements
            for (const stmt of this.preparedStatements.values()) {
                stmt.finalize();
            }
            
            // Close database
            this.db.close();
            this.db = null;
            this.isInitialized = false;
        }
    }
}

export { SQLiteWrapper };

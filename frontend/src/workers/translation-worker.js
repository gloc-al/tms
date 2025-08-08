/**
 * V8 Isolate Worker for Translation Processing
 * Handles client-side translation with maximum performance
 */

import { SQLiteWrapper } from '../sqlite/sqlite-wrapper.js';
import { CompressionEngine } from '../compression/compression-engine.js';
import { PerformanceMonitor } from '../performance/performance-monitor.js';

class TranslationWorker {
    constructor() {
        this.sqlite = new SQLiteWrapper('/data/tm.db');
        this.compression = new CompressionEngine();
        this.performance = new PerformanceMonitor();
        this.cache = new Map();
        
        // Initialize worker
        this.init();
    }

    async init() {
        // Initialize SQLite WASM
        await this.sqlite.init();
        
        // Load compression dictionaries
        await this.compression.loadDictionaries();
        
        // Set up performance monitoring
        this.performance.startMonitoring();
        
        console.log('Translation Worker initialized');
    }

    async processTranslation(request) {
        const startTime = performance.now();
        
        try {
            // 1. Check local cache first
            const cacheKey = this.generateCacheKey(request);
            if (this.cache.has(cacheKey)) {
                const cached = this.cache.get(cacheKey);
                this.performance.recordMetric('cache_hit', true);
                return cached;
            }

            // 2. Query local TM database
            const tmMatches = await this.queryTM(request);
            
            // 3. If good TM match found, use it
            if (tmMatches.length > 0 && tmMatches[0].score > 0.9) {
                const result = this.leverageTMMatch(tmMatches[0], request);
                this.cacheResult(cacheKey, result);
                return result;
            }

            // 4. Fallback to AI translation (client-side or API)
            const translation = await this.performAITranslation(request, tmMatches);
            
            // 5. Store in local TM for future use
            await this.storeTMEntry(request, translation);
            
            // 6. Cache result
            this.cacheResult(cacheKey, translation);
            
            const processingTime = performance.now() - startTime;
            this.performance.recordMetric('translation_time', processingTime);
            
            return translation;
            
        } catch (error) {
            console.error('Translation processing error:', error);
            this.performance.recordMetric('translation_error', true);
            throw error;
        }
    }

    async queryTM(request) {
        const { text, sourceLocale, targetLocale } = request;
        
        // Generate fuzzy hash for matching
        const sourceHash = this.compression.generateHash(text);
        
        // Query SQLite for matches
        const query = `
            SELECT 
                target_text,
                source_text,
                score,
                created_at
            FROM translation_memory 
            WHERE 
                source_hash = ? 
                AND source_locale = ? 
                AND target_locale = ?
            ORDER BY score DESC, created_at DESC
            LIMIT 10
        `;
        
        const matches = await this.sqlite.execute(query, [
            sourceHash,
            sourceLocale,
            targetLocale
        ]);
        
        // Calculate fuzzy match scores
        return matches.map(match => ({
            ...match,
            score: this.calculateFuzzyScore(text, match.source_text)
        })).filter(match => match.score > 0.7);
    }

    leverageTMMatch(match, request) {
        return {
            translation: match.target_text,
            confidence: match.score,
            source: 'tm',
            processingTime: 1, // Very fast TM lookup
            alternatives: []
        };
    }

    async performAITranslation(request, tmMatches) {
        const { text, sourceLocale, targetLocale, context } = request;
        
        // Compress request for network efficiency
        const compressedRequest = await this.compression.compress({
            text,
            sourceLocale,
            targetLocale,
            context,
            tmMatches: tmMatches.slice(0, 3) // Top 3 matches only
        });
        
        // Call AI service (minimal server processing)
        const response = await fetch('/api/translation/translate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Encoding': 'lz4'
            },
            body: compressedRequest
        });
        
        const result = await this.compression.decompress(await response.arrayBuffer());
        
        return {
            translation: result.translation,
            confidence: result.confidence,
            source: 'ai',
            processingTime: result.processing_time,
            alternatives: result.alternatives || []
        };
    }

    async storeTMEntry(request, translation) {
        const { text, sourceLocale, targetLocale } = request;
        const sourceHash = this.compression.generateHash(text);
        
        const query = `
            INSERT OR REPLACE INTO translation_memory 
            (source_hash, source_text, target_text, source_locale, target_locale, score, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        
        await this.sqlite.execute(query, [
            sourceHash,
            text,
            translation.translation,
            sourceLocale,
            targetLocale,
            translation.confidence,
            Date.now()
        ]);
    }

    generateCacheKey(request) {
        const keyData = `${request.text}:${request.sourceLocale}:${request.targetLocale}`;
        return this.compression.generateHash(keyData);
    }

    cacheResult(key, result) {
        // Keep cache size under control (max 1000 entries)
        if (this.cache.size >= 1000) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        
        this.cache.set(key, result);
    }

    calculateFuzzyScore(text1, text2) {
        // Simple fuzzy matching algorithm
        // In production, use more sophisticated algorithms like Levenshtein distance
        const similarity = this.stringSimilarity(text1, text2);
        return similarity;
    }

    stringSimilarity(str1, str2) {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) return 1.0;
        
        const editDistance = this.editDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
    }

    editDistance(str1, str2) {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
    }
}

// Worker message handling
let worker;

self.onmessage = async function(e) {
    if (!worker) {
        worker = new TranslationWorker();
    }
    
    const { id, type, data } = e.data;
    
    try {
        let result;
        
        switch (type) {
            case 'translate':
                result = await worker.processTranslation(data);
                break;
            case 'queryTM':
                result = await worker.queryTM(data);
                break;
            default:
                throw new Error(`Unknown message type: ${type}`);
        }
        
        self.postMessage({ id, success: true, result });
        
    } catch (error) {
        self.postMessage({ 
            id, 
            success: false, 
            error: error.message 
        });
    }
};

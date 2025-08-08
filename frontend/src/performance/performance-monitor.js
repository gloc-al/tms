/**
 * Performance Monitor for Self-Improving UX
 * Tracks metrics and automatically optimizes based on real-time data
 */

class PerformanceMonitor {
    constructor() {
        this.metrics = new Map();
        this.thresholds = {
            bundleSize: 14000,      // 14kB max
            renderTime: 16,         // 16ms max (60fps)
            memoryUsage: 50 * 1024 * 1024,  // 50MB max
            cacheHitRate: 0.9,      // 90% min
            compressionRatio: 0.2,  // 80% compression min
            translationTime: 100,   // 100ms max for translations
            tmLookupTime: 5,        // 5ms max for TM lookups
            sqliteQueryTime: 10     // 10ms max for SQLite queries
        };
        
        this.optimizations = new Map();
        this.isMonitoring = false;
        this.alertCallbacks = new Set();
        
        // Performance history for trend analysis
        this.history = {
            renderTimes: [],
            memoryUsage: [],
            cacheHitRates: [],
            translationTimes: []
        };
        
        // Auto-optimization strategies
        this.strategies = {
            enableVirtualScrolling: false,
            enableLazyLoading: false,
            enableCompressionCache: false,
            enablePredictivePreloading: false,
            enableBundleOptimization: false
        };
    }

    startMonitoring() {
        if (this.isMonitoring) return;
        
        this.isMonitoring = true;
        
        // Start various monitoring systems
        this.startRenderMonitoring();
        this.startMemoryMonitoring();
        this.startPerformanceObserver();
        this.startBundleSizeMonitoring();
        
        console.log('Performance monitoring started');
    }

    stopMonitoring() {
        this.isMonitoring = false;
        
        if (this.renderMonitorInterval) {
            clearInterval(this.renderMonitorInterval);
        }
        
        if (this.memoryMonitorInterval) {
            clearInterval(this.memoryMonitorInterval);
        }
        
        if (this.performanceObserver) {
            this.performanceObserver.disconnect();
        }
        
        console.log('Performance monitoring stopped');
    }

    startRenderMonitoring() {
        let lastFrameTime = performance.now();
        let frameCount = 0;
        
        const measureRenderTime = () => {
            const currentTime = performance.now();
            const frameTime = currentTime - lastFrameTime;
            lastFrameTime = currentTime;
            frameCount++;
            
            // Record render time
            this.recordMetric('renderTime', frameTime);
            
            // Check if we're dropping frames
            if (frameTime > this.thresholds.renderTime) {
                this.handlePerformanceViolation('renderTime', frameTime);
            }
            
            // Update history every 100 frames
            if (frameCount % 100 === 0) {
                this.updateRenderHistory();
            }
            
            if (this.isMonitoring) {
                requestAnimationFrame(measureRenderTime);
            }
        };
        
        requestAnimationFrame(measureRenderTime);
    }

    startMemoryMonitoring() {
        this.memoryMonitorInterval = setInterval(() => {
            if ('memory' in performance) {
                const memInfo = performance.memory;
                const currentUsage = memInfo.usedJSHeapSize;
                
                this.recordMetric('memoryUsage', currentUsage);
                
                if (currentUsage > this.thresholds.memoryUsage) {
                    this.handlePerformanceViolation('memoryUsage', currentUsage);
                }
                
                // Update memory history
                this.history.memoryUsage.push({
                    timestamp: Date.now(),
                    usage: currentUsage,
                    total: memInfo.totalJSHeapSize,
                    limit: memInfo.jsHeapSizeLimit
                });
                
                // Keep history limited
                if (this.history.memoryUsage.length > 100) {
                    this.history.memoryUsage.shift();
                }
            }
        }, 1000); // Check every second
    }

    startPerformanceObserver() {
        if ('PerformanceObserver' in window) {
            this.performanceObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    this.handlePerformanceEntry(entry);
                }
            });
            
            // Observe different types of performance entries
            try {
                this.performanceObserver.observe({ entryTypes: ['measure', 'navigation', 'paint'] });
            } catch (e) {
                console.warn('Some performance observation features not supported:', e);
            }
        }
    }

    startBundleSizeMonitoring() {
        // Monitor bundle size through resource timing
        const checkBundleSize = () => {
            const resources = performance.getEntriesByType('resource');
            let totalSize = 0;
            
            resources.forEach(resource => {
                if (resource.name.includes('.js') || resource.name.includes('.css')) {
                    totalSize += resource.transferSize || 0;
                }
            });
            
            this.recordMetric('bundleSize', totalSize);
            
            if (totalSize > this.thresholds.bundleSize) {
                this.handlePerformanceViolation('bundleSize', totalSize);
            }
        };
        
        // Check on load and periodically
        window.addEventListener('load', checkBundleSize);
        setInterval(checkBundleSize, 30000); // Every 30 seconds
    }

    recordMetric(name, value) {
        if (!this.metrics.has(name)) {
            this.metrics.set(name, []);
        }
        
        const metric = this.metrics.get(name);
        metric.push({
            value,
            timestamp: Date.now()
        });
        
        // Keep only recent metrics (last 1000 entries)
        if (metric.length > 1000) {
            metric.shift();
        }
        
        // Trigger real-time optimization checks
        this.checkForOptimizationOpportunities(name, value);
    }

    handlePerformanceEntry(entry) {
        switch (entry.entryType) {
            case 'measure':
                this.recordMetric(`custom_${entry.name}`, entry.duration);
                break;
                
            case 'navigation':
                this.recordMetric('pageLoadTime', entry.loadEventEnd - entry.loadEventStart);
                this.recordMetric('domContentLoaded', entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart);
                break;
                
            case 'paint':
                if (entry.name === 'first-contentful-paint') {
                    this.recordMetric('firstContentfulPaint', entry.startTime);
                }
                break;
        }
    }

    handlePerformanceViolation(metricName, value) {
        console.warn(`Performance violation: ${metricName} = ${value}, threshold = ${this.thresholds[metricName]}`);
        
        // Trigger automatic optimizations
        this.triggerAutoOptimization(metricName, value);
        
        // Notify callbacks
        this.alertCallbacks.forEach(callback => {
            try {
                callback(metricName, value, this.thresholds[metricName]);
            } catch (e) {
                console.error('Performance alert callback error:', e);
            }
        });
    }

    triggerAutoOptimization(metricName, value) {
        switch (metricName) {
            case 'renderTime':
                if (value > this.thresholds.renderTime * 2) {
                    this.enableOptimization('virtualScrolling');
                    this.enableOptimization('lazyLoading');
                }
                break;
                
            case 'memoryUsage':
                if (value > this.thresholds.memoryUsage * 0.8) {
                    this.cleanupMemory();
                    this.enableOptimization('compressionCache');
                }
                break;
                
            case 'bundleSize':
                this.enableOptimization('bundleOptimization');
                break;
                
            case 'translationTime':
                this.enableOptimization('predictivePreloading');
                break;
        }
    }

    enableOptimization(strategy) {
        if (this.strategies[strategy]) return; // Already enabled
        
        this.strategies[strategy] = true;
        this.optimizations.set(strategy, Date.now());
        
        switch (strategy) {
            case 'virtualScrolling':
                this.enableVirtualScrolling();
                break;
                
            case 'lazyLoading':
                this.enableLazyLoading();
                break;
                
            case 'compressionCache':
                this.enableCompressionCache();
                break;
                
            case 'predictivePreloading':
                this.enablePredictivePreloading();
                break;
                
            case 'bundleOptimization':
                this.optimizeBundles();
                break;
        }
        
        console.log(`Auto-optimization enabled: ${strategy}`);
    }

    enableVirtualScrolling() {
        // Signal to UI components to enable virtual scrolling
        window.dispatchEvent(new CustomEvent('performance:enableVirtualScrolling'));
    }

    enableLazyLoading() {
        // Enable lazy loading for images and components
        window.dispatchEvent(new CustomEvent('performance:enableLazyLoading'));
    }

    enableCompressionCache() {
        // Enable more aggressive compression caching
        window.dispatchEvent(new CustomEvent('performance:enableCompressionCache'));
    }

    enablePredictivePreloading() {
        // Enable ML-driven content prefetching
        window.dispatchEvent(new CustomEvent('performance:enablePredictivePreloading'));
    }

    optimizeBundles() {
        // Signal to build system to optimize bundles
        console.warn('Bundle size exceeded threshold - consider code splitting');
    }

    cleanupMemory() {
        // Force garbage collection if available
        if (window.gc) {
            window.gc();
        }
        
        // Clear old cache entries
        window.dispatchEvent(new CustomEvent('performance:cleanupMemory'));
    }

    checkForOptimizationOpportunities(metricName, value) {
        // Trend analysis for proactive optimization
        const recentMetrics = this.getRecentMetrics(metricName, 10);
        
        if (recentMetrics.length >= 10) {
            const trend = this.calculateTrend(recentMetrics);
            
            if (trend > 0.1 && value > this.thresholds[metricName] * 0.8) {
                // Performance is degrading, enable optimizations preemptively
                this.triggerAutoOptimization(metricName, value);
            }
        }
    }

    calculateTrend(metrics) {
        if (metrics.length < 2) return 0;
        
        const n = metrics.length;
        const sumX = (n * (n - 1)) / 2;
        const sumY = metrics.reduce((sum, m) => sum + m.value, 0);
        const sumXY = metrics.reduce((sum, m, i) => sum + i * m.value, 0);
        const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        return slope;
    }

    getRecentMetrics(metricName, count) {
        const metric = this.metrics.get(metricName);
        if (!metric) return [];
        
        return metric.slice(-count);
    }

    updateRenderHistory() {
        const recentRenderTimes = this.getRecentMetrics('renderTime', 100);
        const avgRenderTime = recentRenderTimes.reduce((sum, m) => sum + m.value, 0) / recentRenderTimes.length;
        
        this.history.renderTimes.push({
            timestamp: Date.now(),
            average: avgRenderTime,
            max: Math.max(...recentRenderTimes.map(m => m.value)),
            min: Math.min(...recentRenderTimes.map(m => m.value))
        });
        
        if (this.history.renderTimes.length > 100) {
            this.history.renderTimes.shift();
        }
    }

    getPerformanceReport() {
        const report = {};
        
        for (const [name, threshold] of Object.entries(this.thresholds)) {
            const recentMetrics = this.getRecentMetrics(name, 10);
            
            if (recentMetrics.length > 0) {
                const latest = recentMetrics[recentMetrics.length - 1].value;
                const average = recentMetrics.reduce((sum, m) => sum + m.value, 0) / recentMetrics.length;
                
                report[name] = {
                    current: latest,
                    average,
                    threshold,
                    status: latest <= threshold ? 'ok' : 'violation',
                    trend: this.calculateTrend(recentMetrics)
                };
            }
        }
        
        return {
            metrics: report,
            optimizations: Object.fromEntries(this.optimizations),
            strategies: this.strategies,
            timestamp: Date.now()
        };
    }

    onPerformanceAlert(callback) {
        this.alertCallbacks.add(callback);
        
        // Return unsubscribe function
        return () => this.alertCallbacks.delete(callback);
    }

    measureAsync(name, asyncFunction) {
        return async (...args) => {
            const startTime = performance.now();
            
            try {
                const result = await asyncFunction(...args);
                const duration = performance.now() - startTime;
                
                this.recordMetric(name, duration);
                
                return result;
                
            } catch (error) {
                const duration = performance.now() - startTime;
                this.recordMetric(`${name}_error`, duration);
                throw error;
            }
        };
    }

    markMilestone(name) {
        performance.mark(name);
        this.recordMetric(`milestone_${name}`, performance.now());
    }

    measureBetween(startMark, endMark, name) {
        performance.measure(name, startMark, endMark);
        const measure = performance.getEntriesByName(name, 'measure')[0];
        this.recordMetric(name, measure.duration);
    }

    getOptimizationSuggestions() {
        const report = this.getPerformanceReport();
        const suggestions = [];
        
        for (const [metric, data] of Object.entries(report.metrics)) {
            if (data.status === 'violation' || data.trend > 0.1) {
                switch (metric) {
                    case 'renderTime':
                        suggestions.push({
                            metric,
                            issue: 'Slow rendering',
                            suggestion: 'Enable virtual scrolling and component lazy loading',
                            priority: 'high'
                        });
                        break;
                        
                    case 'memoryUsage':
                        suggestions.push({
                            metric,
                            issue: 'High memory usage',
                            suggestion: 'Enable compression cache and memory cleanup',
                            priority: 'medium'
                        });
                        break;
                        
                    case 'bundleSize':
                        suggestions.push({
                            metric,
                            issue: 'Large bundle size',
                            suggestion: 'Implement code splitting and tree shaking',
                            priority: 'high'
                        });
                        break;
                }
            }
        }
        
        return suggestions;
    }
}

export { PerformanceMonitor };

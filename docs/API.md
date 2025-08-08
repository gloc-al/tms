# TMS CAT AI Agent API Documentation

## Overview
The TMS CAT AI Agent API is designed with a **minimal server surface** philosophy. Most processing happens client-side using V8 Isolate Workers, SQLite WASM, and compression engines. The server provides only essential services that cannot be performed client-side.

## Performance Targets
- **Response Time**: < 50ms for all endpoints
- **Payload Size**: < 1kB for most responses
- **Compression**: 80%+ compression for all data
- **Caching**: 90%+ cache hit rate

## Authentication

### POST /api/auth/login
Authenticate user and receive JWT token.

```json
{
  "username": "user@example.com",
  "password": "password"
}
```

**Response:**
```json
{
  "access_token": "jwt_token_here",
  "token_type": "bearer",
  "expires_in": 3600
}
```

## Translation Endpoints

### POST /api/translation/translate
Minimal AI translation endpoint (fallback for client-side processing).

**Headers:**
- `Content-Encoding: lz4` (compressed request)
- `Accept-Encoding: lz4` (compressed response)

**Request (compressed):**
```json
{
  "text": "Hello world",
  "source_locale": "en-US",
  "target_locale": "es-ES",
  "context": "greeting",
  "tm_matches": [
    {
      "source": "Hello",
      "target": "Hola",
      "score": 0.9
    }
  ]
}
```

**Response (compressed):**
```json
{
  "translation": "Hola mundo",
  "confidence": 0.95,
  "processing_time": 25,
  "compression_ratio": 0.2,
  "alternatives": ["Hola mundo", "Buenos días mundo"]
}
```

### GET /api/translation/models
Get available translation models.

**Response:**
```json
{
  "models": [
    {
      "id": "general-v1",
      "name": "General Translation Model",
      "language_pairs": ["en-es", "en-fr", "en-de"],
      "size": "compact",
      "client_compatible": true
    }
  ]
}
```

## Translation Memory Endpoints

### POST /api/tm/sync
Sync client-side TM with server (incremental updates only).

**Request:**
```json
{
  "last_sync": 1699123456789,
  "updates": [
    {
      "source_hash": "abc123",
      "source_text": "Hello",
      "target_text": "Hola",
      "source_locale": "en-US",
      "target_locale": "es-ES",
      "score": 1.0,
      "timestamp": 1699123456790
    }
  ]
}
```

**Response:**
```json
{
  "sync_timestamp": 1699123456800,
  "new_entries": [],
  "deleted_entries": [],
  "conflicts": []
}
```

### GET /api/tm/export/:project_id
Export TM data (compressed for download).

**Query Parameters:**
- `format`: `tmx` | `xliff` | `json`
- `compression`: `lz4` | `gzip` | `brotli`

**Response:** Binary compressed file

## Project Management

### GET /api/projects
Get user's projects (minimal data for client-side processing).

**Response:**
```json
{
  "projects": [
    {
      "id": "proj_123",
      "name": "Website Localization",
      "source_locale": "en-US",
      "target_locales": ["es-ES", "fr-FR"],
      "status": "active",
      "progress": 0.75,
      "last_updated": 1699123456789
    }
  ]
}
```

### POST /api/projects/:id/files
Upload files for translation (with client-side preprocessing).

**Headers:**
- `Content-Type: multipart/form-data`
- `X-File-Hash: sha256_hash` (for deduplication)

**Form Data:**
- `file`: Binary file
- `format`: File format (xliff, json, etc.)
- `preprocessed`: Boolean (client already processed)

## Performance Monitoring

### GET /api/performance/metrics
Get server performance metrics for client optimization.

**Response:**
```json
{
  "server_response_time": 23,
  "compression_ratio": 0.18,
  "cache_hit_rate": 0.94,
  "active_connections": 150,
  "memory_usage": 0.65,
  "cpu_usage": 0.23
}
```

### POST /api/performance/report
Client reports performance metrics to server.

**Request:**
```json
{
  "client_id": "client_uuid",
  "metrics": {
    "bundle_size": 13500,
    "render_time": 12,
    "memory_usage": 45000000,
    "cache_hit_rate": 0.92,
    "translation_time": 85,
    "compression_ratio": 0.19
  },
  "optimizations_enabled": {
    "virtual_scrolling": true,
    "compression_cache": true,
    "predictive_preloading": false
  }
}
```

## File Processing

### POST /api/files/process
Minimal server-side file processing (client should handle most processing).

**Request:**
```json
{
  "file_hash": "sha256_hash",
  "format": "xliff",
  "processing_options": {
    "extract_tm": true,
    "validate_format": true,
    "optimize_size": true
  }
}
```

**Response:**
```json
{
  "status": "success",
  "segments_count": 1250,
  "estimated_words": 8500,
  "processing_time": 45,
  "recommendations": {
    "enable_client_processing": true,
    "use_compression": true
  }
}
```

## WebSocket Endpoints

### WS /api/ws/translation
Real-time translation updates for collaborative editing.

**Message Types:**
- `translation_update`: Real-time translation changes
- `tm_update`: Translation memory updates
- `user_activity`: User cursor/selection changes
- `performance_alert`: Performance threshold violations

## Error Handling

All endpoints use consistent error format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid locale format",
    "details": {
      "field": "source_locale",
      "expected": "BCP 47 format (e.g., en-US)"
    }
  },
  "request_id": "req_123456789"
}
```

## Rate Limiting

- **Authentication**: 10 requests/minute
- **Translation**: 100 requests/minute
- **TM Sync**: 20 requests/minute
- **File Upload**: 5 requests/minute

## Compression

All requests/responses support multiple compression formats:

1. **LZ4**: Fastest compression/decompression
2. **Brotli**: Best compression ratio
3. **Gzip**: Broad compatibility

Client should prefer LZ4 for real-time operations and Brotli for file transfers.

## Client-Side Integration

### JavaScript Example

```javascript
import { TranslationAPI } from './api-client.js';
import { CompressionEngine } from './compression/compression-engine.js';

const api = new TranslationAPI({
  baseURL: 'http://localhost:8000/api',
  compression: 'lz4',
  timeout: 5000
});

// Compressed translation request
const result = await api.translate({
  text: 'Hello world',
  sourceLocale: 'en-US',
  targetLocale: 'es-ES'
});
```

### Performance Monitoring Integration

```javascript
import { PerformanceMonitor } from './performance/performance-monitor.js';

const monitor = new PerformanceMonitor();

// Automatically report metrics to server
monitor.onPerformanceAlert((metric, value, threshold) => {
  api.reportPerformance({
    metric,
    value,
    threshold,
    timestamp: Date.now()
  });
});
```

## Development

### Local Development
```bash
# Start all services
docker-compose up -d

# API will be available at:
# http://localhost:8000/api/docs (development only)
```

### Testing
```bash
# Run API tests
pytest backend/tests/

# Performance testing
locust -f tests/performance/locustfile.py
```

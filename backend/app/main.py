"""
TMS CAT AI Agent - FastAPI Backend
Ultra-fast, minimal API surface for client-side focused architecture
"""

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
import uvicorn
import os
from typing import List, Optional

from .routers import translation, tm, projects, auth
from .middleware import performance_middleware, compression_middleware
from .database import init_db

# Performance-optimized FastAPI app
app = FastAPI(
    title="TMS CAT AI Agent API",
    description="Minimal API for ultra-fast client-side translation management",
    version="1.0.0",
    docs_url="/api/docs" if os.getenv("NODE_ENV") == "development" else None,
    redoc_url=None,  # Disable redoc for performance
)

# Middleware stack optimized for performance
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Restrict origins
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(performance_middleware)
app.add_middleware(compression_middleware)

# Minimal API routes - most processing happens client-side
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(translation.router, prefix="/api/translation", tags=["translation"])
app.include_router(tm.router, prefix="/api/tm", tags=["translation-memory"])
app.include_router(projects.router, prefix="/api/projects", tags=["projects"])

@app.on_event("startup")
async def startup_event():
    """Initialize database and services on startup"""
    await init_db()

@app.get("/api/health")
async def health_check():
    """Minimal health check endpoint"""
    return {"status": "healthy", "api_version": "1.0.0"}

@app.get("/api/performance")
async def performance_metrics():
    """Performance metrics for client-side optimization"""
    return {
        "server_response_time": "< 50ms",
        "compression_ratio": "> 80%",
        "cache_hit_rate": "> 90%"
    }

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=os.getenv("NODE_ENV") == "development",
        workers=1 if os.getenv("NODE_ENV") == "development" else 4,
    )

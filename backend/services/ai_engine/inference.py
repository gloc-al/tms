"""
AI Translation Engine
Optimized for client-side integration and minimal server processing
"""

import asyncio
from typing import Dict, List, Optional
import hashlib
import json
from dataclasses import dataclass

@dataclass
class TranslationRequest:
    text: str
    source_locale: str
    target_locale: str
    context: Optional[str] = None
    tm_matches: Optional[List[Dict]] = None

@dataclass
class TranslationResponse:
    translation: str
    confidence: float
    alternatives: List[str]
    processing_time: float
    compression_ratio: Optional[float] = None

class AITranslationEngine:
    """
    Lightweight AI translation engine designed for client-side integration
    Most heavy processing happens on client via V8 workers
    """
    
    def __init__(self):
        self.cache = {}  # Simple in-memory cache
        self.compression_dict = self._load_compression_dict()
    
    async def translate(self, request: TranslationRequest) -> TranslationResponse:
        """
        Fast translation with aggressive caching and compression
        """
        # Generate cache key
        cache_key = self._generate_cache_key(request)
        
        # Check cache first
        if cache_key in self.cache:
            return self.cache[cache_key]
        
        # Process translation (minimal server-side processing)
        start_time = asyncio.get_event_loop().time()
        
        # Use TM matches if available (prefer client-side TM)
        if request.tm_matches and len(request.tm_matches) > 0:
            translation = self._leverage_tm_match(request)
        else:
            translation = await self._ai_translate(request)
        
        end_time = asyncio.get_event_loop().time()
        processing_time = (end_time - start_time) * 1000  # Convert to ms
        
        response = TranslationResponse(
            translation=translation,
            confidence=0.95,  # Simplified for demo
            alternatives=[],
            processing_time=processing_time,
            compression_ratio=self._calculate_compression_ratio(request.text, translation)
        )
        
        # Cache for future requests
        self.cache[cache_key] = response
        
        return response
    
    def _generate_cache_key(self, request: TranslationRequest) -> str:
        """Generate unique cache key for translation request"""
        key_data = f"{request.text}:{request.source_locale}:{request.target_locale}"
        return hashlib.md5(key_data.encode()).hexdigest()
    
    def _leverage_tm_match(self, request: TranslationRequest) -> str:
        """Use TM match instead of AI translation for better performance"""
        best_match = max(request.tm_matches, key=lambda x: x.get('score', 0))
        return best_match.get('target', request.text)
    
    async def _ai_translate(self, request: TranslationRequest) -> str:
        """
        Minimal AI translation - most AI processing should happen client-side
        This is just a fallback for when client can't handle the request
        """
        # Simplified translation logic
        # In production, this would call external APIs or local models
        await asyncio.sleep(0.01)  # Simulate minimal processing time
        return f"[Translated: {request.text}]"
    
    def _calculate_compression_ratio(self, original: str, translated: str) -> float:
        """Calculate compression ratio for performance metrics"""
        original_size = len(original.encode('utf-8'))
        compressed_size = len(self._compress_text(translated))
        return compressed_size / original_size if original_size > 0 else 1.0
    
    def _compress_text(self, text: str) -> bytes:
        """Simple text compression for demonstration"""
        # In production, use LZ4/Brotli with domain-specific dictionaries
        return text.encode('utf-8')
    
    def _load_compression_dict(self) -> Dict:
        """Load locale-specific compression dictionaries"""
        # In production, load actual compression dictionaries
        return {
            "en": {"common_words": ["the", "and", "or", "but"]},
            "es": {"common_words": ["el", "la", "y", "o"]},
            "ar": {"common_words": ["في", "من", "إلى", "على"]}
        }

# Global instance
ai_engine = AITranslationEngine()

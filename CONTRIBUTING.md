# Contributing to TMS CAT AI Agent

## Development Guidelines

### Performance Requirements
- All pages must be < 14kB when rendered
- Render time must be < 16ms
- Memory usage must be < 50MB
- Cache hit rate must be > 90%

### Code Standards
- Follow conventional commits
- All PRs require tests, docs, and maintainer approval
- Keep modules small and dependency-free
- Use TypeScript for type safety
- Implement aggressive tree-shaking

### Branch Policies
- `main` branch is protected and requires PR reviews
- Feature branches: `feature/description`
- Hotfix branches: `hotfix/description`
- Release branches: `release/v1.x.x`

### Testing Requirements
- Unit tests for all core functions
- Performance tests for client-side components
- E2E tests for critical user flows
- Compression ratio tests for text optimization

### Performance Testing
```bash
# Run performance benchmarks
npm run test:performance

# Check bundle sizes
npm run analyze:bundle

# Test compression ratios
npm run test:compression
```

### CI/CD Pipeline
1. Automated testing on all PRs
2. Performance regression detection
3. Bundle size monitoring
4. Security scanning
5. Automated deployment to staging

## Architecture Principles

### Client-Side First
- Maximum computation on client
- Minimal server API surface
- Aggressive caching strategies
- Local data processing

### Performance Optimization
- V8 Isolate Workers for parallel processing
- SQLite WASM for local storage
- Dictionary-based compression
- Self-improving UX algorithms

## Getting Started

1. Fork the repository
2. Clone your fork locally
3. Install dependencies: `npm install`
4. Run development server: `npm run dev`
5. Create feature branch
6. Make changes with tests
7. Submit pull request

## Code Review Process

### Required Checks
- [ ] Performance benchmarks pass
- [ ] Bundle size under 14kB
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Security review completed

### Review Criteria
- Code quality and maintainability
- Performance impact analysis
- Security implications
- Documentation completeness
- Test coverage adequacy

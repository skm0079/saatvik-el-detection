# ========================================
# LEARNING SUMMARY FOR TOMORROW:
# ========================================
"""
KEY LEARNINGS:

1. FastAPI Route Order Matters:
   - Routes are matched in the order they're declared
   - app.mount("/", ...) creates a catch-all that intercepts everything
   - Always include API routes BEFORE mounting static files at root

2. Proper Mounting Strategy:
   - API routes first: app.include_router(api_router, prefix="/api/v1")
   - Specific static mounts: app.mount("/processed", StaticFiles(...))
   - Root static mount LAST: app.mount("/", StaticFiles(...))

3. SPA + API Integration:
   - SPAs need catch-all routing for client-side navigation
   - But this conflicts with API routes if mounted incorrectly
   - Solution: Custom StaticFiles class that excludes /api/ paths

4. Docker Development:
   - Code changes need proper volume mounting to reflect in container
   - Static file builds persist in containers even after code changes
   - Always test API endpoints separately from frontend

5. Debugging Steps:
   - Test API endpoints directly: curl http://localhost:8000/api/v1/health
   - Check what files exist: ls app/static/
   - Verify route order in main.py
   - Remove static files temporarily to isolate issues

PRODUCTION DEPLOYMENT:
- Build React app: npm run build (outputs to app/static/)
- FastAPI serves both API and static files on same port
- No separate web server needed (nginx optional for scaling)
"""
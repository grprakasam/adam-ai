# Deployment Checklist - Code Review & Pseudo-Code Features

## Pre-Deployment Verification

### Code Quality
- [ ] All tests passing (36/36)
- [ ] No TypeScript errors
- [ ] No ESLint warnings
- [ ] Code formatted with black (Python)

### Security
- [ ] No hardcoded secrets or API keys
- [ ] Environment variables properly configured
- [ ] Dependencies up to date
- [ ] No known vulnerabilities

### Documentation
- [ ] README.md updated with new features
- [ ] API documentation complete
- [ ] User guide reviewed and accurate
- [ ] Troubleshooting guide created
- [ ] CHANGELOG.md updated

### Database (if applicable)
- [ ] Migration scripts created
- [ ] Backup strategy in place
- [ ] Schema validated
- [ ] Indexes optimized
- [ ] Connection pooling configured

### Performance
- [ ] Load time < 1 second
- [ ] API response time < 200ms
- [ ] Database query time < 100ms
- [ ] Memory usage stable
- [ ] No memory leaks detected

## Testing Verification

### Unit Tests
- [ ] Backend code review tests: 18/18 passing
- [ ] Backend pseudo-code tests: 18/18 passing
- [ ] Frontend component tests
- [ ] API endpoint tests

### Integration Tests
- [ ] Frontend ↔ Backend communication
- [ ] Database persistence
- [ ] Complete workflow end-to-end
- [ ] Error handling across layers

### Manual Testing
- [ ] Pair Programming → Code Review workflow
- [ ] Approval status changes
- [ ] Comment system
- [ ] Workflow navigation
- [ ] Study switching guard
- [ ] Warning banner on consolidated code

### Browser Compatibility
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

### Responsive Design
- [ ] Desktop (1920x1080)
- [ ] Tablet (768x1024)
- [ ] Mobile (375x667)

## Build & Deployment

### Backend Build
```bash
cd backend
pip install -r requirements.txt
alembic upgrade head
python -m pytest tests/ -v
docker build -f Dockerfile -t adam-ai-backend:v1.0.0 .
```

### Frontend Build
```bash
cd frontend
npm install
npm run build
docker build -f Dockerfile -t adam-ai-frontend:v1.0.0 .
```

### Configuration
- [ ] Environment variables set correctly
- [ ] Database connection string validated
- [ ] API endpoints configured
- [ ] Logging configured
- [ ] CORS settings appropriate
- [ ] Authentication configured

## Deployment Steps

### 1. Pre-Deployment
```bash
# Create backup
tar -czf backup-$(date +%Y%m%d).tar.gz /path/to/deployment

# Tag release
git tag -a v1.0.0 -m "Release: Code review and pseudo-code features"
git push origin v1.0.0
```

### 2. Backend Deployment
```bash
# Deploy code
git pull origin release/v1.0.0

# Install dependencies
pip install -r requirements.txt

# Run migrations
alembic upgrade head

# Restart service
systemctl restart adam-ai-backend
# Or: docker restart adam-ai-backend

# Verify health check
curl http://localhost:8000/health
```

### 3. Frontend Deployment
```bash
# Build production bundle
npm run build

# Deploy to web server
cp -r dist/* /var/www/adam-ai/
```

### 4. Verify Deployment
- [ ] Website accessible
- [ ] API endpoints responding
- [ ] Database connections working
- [ ] No errors in logs
- [ ] Performance acceptable
- [ ] All features functioning

## Post-Deployment

### Immediate Actions (Hour 1)
- [ ] Monitor error logs
- [ ] Check application performance
- [ ] Verify all endpoints responding
- [ ] Test complete workflow as user

### Short-Term (First 24 hours)
- [ ] Monitor system metrics
- [ ] Track error rates
- [ ] Collect initial user feedback
- [ ] Document any issues
- [ ] Prepare rollback plan if needed

### Follow-Up (First Week)
- [ ] Analyze usage patterns
- [ ] Check performance metrics
- [ ] Review error logs
- [ ] Gather user feedback
- [ ] Plan improvements

## Rollback Plan

### If Deployment Fails

**Immediate Actions:**
```bash
# Stop new application
systemctl stop adam-ai-backend adam-ai-frontend

# Restore from backup
tar -xzf backup-[timestamp].tar.gz -C /

# Restart services
systemctl start adam-ai-backend adam-ai-frontend

# Verify restoration
curl http://localhost:8000/health
```

**Database Rollback:**
```bash
# Rollback migrations
alembic downgrade -1

# Restore database backup
mysql adam_ai < backup-[timestamp].sql
```

**Frontend Rollback:**
```bash
# Restore previous build
rm -rf /var/www/adam-ai/*
cp -r backup-dist/* /var/www/adam-ai/
```

## Monitoring & Alerting

### Set Up Monitoring
- [ ] Application health checks
- [ ] Error rate monitoring
- [ ] Performance monitoring
- [ ] Database monitoring
- [ ] Server resource monitoring
- [ ] Log aggregation

### Key Metrics to Track
- HTTP response times (target: < 200ms)
- Error rate (target: < 0.1%)
- Uptime (target: > 99.9%)
- Memory usage (target: < 80%)
- CPU usage (target: < 70%)
- Database connections (target: < 80 of max)

### Alerting Thresholds
- Error rate > 1%: Page on-call
- Response time > 1s: Send notification
- Memory > 90%: Send notification
- Disk space < 10%: Send notification
- Service down > 5 min: Page on-call

## Support & Maintenance

### Day 1 Support
- [ ] Dev team on standby
- [ ] Monitoring dashboards active
- [ ] Escalation contacts available
- [ ] Issue tracking system ready

### Ongoing Maintenance
- [ ] Daily log review
- [ ] Weekly performance review
- [ ] Monthly security audit
- [ ] Quarterly dependency updates
- [ ] Annual architecture review

## Sign-Off

### Required Approvals
- [ ] QA Lead: _________________ Date: _______
- [ ] Security Lead: __________ Date: _______
- [ ] DevOps Lead: __________ Date: _______
- [ ] Product Owner: ________ Date: _______
- [ ] Tech Lead: ____________ Date: _______

### Deployment Completed By
**Name:** ___________________________
**Date:** ____________________________
**Time:** ____________________________
**Notes:** ___________________________

### Verified By
**Name:** ___________________________
**Date:** ____________________________
**Issues Found:** None / [List below]
- ___________________________________
- ___________________________________

---

## Appendix: Common Issues & Solutions

### Port Already in Use
```bash
lsof -i :8000
kill -9 <PID>
```

### Database Connection Failed
```bash
# Check credentials
cat .env | grep DATABASE_URL

# Test connection
mysql -h host -u user -p database
psql -h host -U user -d database
```

### SSL Certificate Issues
```bash
# Generate self-signed cert (development only)
openssl req -x509 -newkey rsa:4096 -nodes \
  -out cert.pem -keyout key.pem -days 365
```

### CORS Errors
```python
# Check CORS configuration in app
# Usually in app/main.py or middleware config
CORS_ALLOWED_ORIGINS = ["https://yourdomain.com"]
```

### Memory Leaks
```bash
# Monitor memory usage
top -p $(pgrep -f "python -m uvicorn")

# Check for unclosed connections
# Review database connection pooling config
```

---

**Deployment Date:** _________________
**Version:** v1.0.0
**Status:** Pending / In Progress / Complete / Rolled Back

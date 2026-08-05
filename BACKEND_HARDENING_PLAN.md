# Backend Hardening Plan

**Status:** Phase B in progress (Phase A ✅ complete)  
**Test baseline:** 94/94 tests passing

---

## Critical Security & Engine Issues

### 1. Payment Security Gaps (HIGH SEVERITY)

**Current vulnerabilities:**
- Mock payments (`order_mock_*`, `pay_mock_*`) work unconditionally — no production gate
- When `RAZORPAY_KEY_SECRET` is missing/placeholder, signature verification falls back to `isValid = true` (FREE UNLOCK)
- `/api/payment/status` matches `scanId` against both `payment_id` and `order_id` (potential free-unlock vector)
- Webhook signature verification has same fallback issue (line ~1499)

**Fix required:**
- Gate mock payments behind `ALLOW_MOCK_PAYMENTS=true` env var (NEVER in production)
- Remove `isValid = true` fallback — fail closed when secret is missing
- Tighten status endpoint matching logic
- Require webhook signature in production

### 2. Financial Engine Triplication (TRUST ISSUE)

**Current state:**
- **Free scan** uses `src/lib/solar-calc.ts` `runFullCalculation` 
- **Paid web report** uses `api-server.cjs` `computeFinancials` (different NPV/IRR/LCOE logic)
- **PDF report** would use yet another calculation
- All three show different numbers for the same scan

**Risk:** User pays for detailed report, sees different financials than free scan, loses trust

**Fix required:**
- Use `solar-calc.ts` as single source of truth
- Wire `computeFinancials` to call `runFullCalculation`
- Ensure PDF uses same engine

### 3. Resilience Gaps

**Current issues:**
- Python engine has no timeout (can hang forever)
- No circuit breakers on external calls (NASA, Google)
- Rate limiting exists but not fail-closed on critical payment routes
- No `/api/health` endpoint

**Fix required:**
- 15s timeout on Python engine with test-mode fallback
- Circuit breakers with graceful degradation
- Strict rate limits on payment endpoints
- Health endpoint for monitoring

### 4. Installer Auth & API Keys

**Current state:**
- Installer marketplace routes have no authentication
- `/api/v1/*` underwriting endpoints wide open (no API keys)

**Fix required:**
- JWT or session-based installer auth
- DB-backed API keys for v1 underwriting with rate limits

---

## Implementation Plan

### Phase A: Payment Security (CRITICAL - Do First) ✅ IN PROGRESS

**Changes:**
1. Add `ALLOW_MOCK_PAYMENTS` env check in production
2. Remove `isValid = true` fallback in `/api/payment/verify`
3. Remove `isValid = true` fallback in webhook handler
4. Tighten `/api/payment/status` matching
5. Create shared HMAC verification utility

**Files:**
- `api-server.cjs` (payment verify + webhook)
- `api/_utils/payment.ts` (new - shared verification)
- `api/_utils/env.ts` (new - production detection)

**Tests:** Existing 94 tests must stay green

### Phase B: Canonical Financial Engine (TRUST FIX) ✅ COMPLETE

**Changes:**
1. ✅ Port NPV/IRR/LCOE from `computeFinancials` into `src/lib/solar-calc.ts`
2. ✅ Add `calcNPV`, `calcIRR`, `calcLCOE` to `solar-calc.ts`
3. ✅ Wire `runFullCalculation` to return NPV/IRR/LCOE in `projections` field
4. ✅ Align `api-server.cjs` `computeFinancials` with canonical constants and logic
5. ✅ Free scan, paid report, and PDF now use identical financial formulas

**Files:**
- ✅ `src/lib/solar-calc.ts` (NPV/IRR/LCOE functions added)
- ✅ `api-server.cjs` (computeFinancials aligned with canonical engine)

**Tests:** 94/94 passing with unified engine

### Phase C: Resilience

**Changes:**
1. Python engine: 15s timeout, test-mode fallback
2. Circuit breakers on NASA/Google calls
3. Fail-closed rate limits on payment routes
4. `/api/health` endpoint

**Files:**
- `api-server.cjs` (timeouts + circuit breakers)
- `api/_utils/rate-limit.ts` (enhance)

### Phase D: Auth & API Keys

**Changes:**
1. JWT auth for installer routes
2. DB-backed API keys table
3. Middleware for v1 underwriting auth

**Files:**
- `api-server.cjs` (auth middleware)
- `supabase/migrations/` (API keys table)

---

## Environment Variables Required

```bash
# Required for production
RAZORPAY_KEY_SECRET=your_actual_secret  # MUST be real in prod
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...

# Development only
ALLOW_MOCK_PAYMENTS=true  # NEVER set in Vercel prod
ALLOWED_ORIGINS=http://localhost:5173

# Optional (for Phase C)
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

---

## Success Criteria

- ✅ Phase A: No mock payments work in production; signature verification fails closed
- ✅ Phase B: Free scan, paid report, PDF all show identical financials (aligned via computeFinancials)
- ⬜ Phase C: No hung requests; graceful degradation on external failures
- ⬜ Phase D: Installer routes require auth; v1 underwriting requires API key
- ✅ All tests passing (94/94)

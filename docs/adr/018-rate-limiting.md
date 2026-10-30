# ADR-018 · Rate limiting

- Status: Accepted
- Date: 2026-10-29
- Related: Refined; approval: No; stage S3

> Approved with the architecture review on 29 Oct 2026 (DEC-01).

## Record

- **Decision:** keep DEMO's atomic DB counter (`public_rate_limits` + SQL function), widen scopes; identity = HMAC visitor hash (BR-75) from the trusted client-IP header. **Confirm on Vercel which header is authoritative** (ARC step 10): `S1-SPK-03`. No Redis.

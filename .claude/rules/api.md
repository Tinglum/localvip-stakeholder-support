# API Rules

## Applies To

Backend and server files:
- API routes
- server actions
- edge functions
- database access
- webhook handlers
- auth logic

---

## Critical Rules

- Validate inputs
- Enforce authorization
- Never expose secrets
- Never leak sensitive internal errors
- Handle failures explicitly
- Make webhook handlers idempotent where applicable
- Return appropriate status codes

---

## Important Rules

- Keep business logic separate from transport logic
- Avoid duplicate validation logic
- Log operational failures where useful
- Use typed responses where possible
- Avoid silent failure
- Avoid swallowing errors without action

---

## Optional Improvements

- Add rate limiting for public endpoints
- Add retry logic for transient external failures
- Add structured logging
- Add request IDs for traceability

---

## Good Pattern

- Validate input
- Check auth
- Execute focused logic
- Handle known errors
- Return clear response

---

## Bad Pattern

- Trusting client input
- No auth check
- Raw exception returned to user
- Non-idempotent webhook
- Secrets in code
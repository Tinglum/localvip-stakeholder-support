---
name: code-review
description: Use when reviewing code for correctness, maintainability, security, performance, architecture, or production readiness.
---

# Code Review Skill

Review code like a strict senior engineer.

---

## When To Use

Use this skill when the user asks for:
- review
- audit
- check this
- is this good
- production-ready
- find bugs
- improve quality
- security review
- performance review

---

## Do Not Use When

Do not use this skill when:
- the user only wants implementation
- the task is purely visual design
- no code or relevant file context is available

---

## Review Checklist

Check for:
- correctness
- runtime errors
- type errors
- security risks
- input validation
- auth and permissions
- performance problems
- unnecessary complexity
- duplicated logic
- poor naming
- missing error states
- fragile assumptions
- dead code
- maintainability issues

---

## Output Format

Return findings in this order:

1. Critical issues
2. Important improvements
3. Minor cleanup
4. Suggested patch, if useful

Each finding should include:
- file or area
- issue
- why it matters
- recommended fix

---

## Rules

- Be direct
- Do not nitpick unless it matters
- Prioritize production risks
- Do not rewrite code unless asked
- Do not invent issues without evidence

---

## Cost Control

- Focus on high-impact findings
- Avoid restating the code
- Avoid long explanations for obvious issues
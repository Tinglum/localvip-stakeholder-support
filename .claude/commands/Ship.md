# /ship

Prepare current work for shipping.

## Steps

1. Inspect git diff
2. Run relevant checks:
   - lint
   - typecheck
   - test
   - build
3. Fix blocking issues only
4. Re-run failed checks
5. Summarize readiness

## Rules

- Do not make unrelated changes
- Do not refactor unless required to pass checks
- Stop after production-blocking issues are handled

## Output

Return:
- Files changed
- Checks run
- Issues fixed
- Remaining risks
- Ship / do not ship recommendation
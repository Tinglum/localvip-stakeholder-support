# /refactor

Improve code structure without changing behavior.

## Steps

1. Inspect the target area
2. Identify duplication, unclear naming, or weak structure
3. Make the smallest useful refactor
4. Preserve behavior
5. Run relevant checks

## Rules

- No feature changes
- No visual redesign unless requested
- No broad rewrites
- Keep public APIs stable unless necessary

## Output

Return:
- What was refactored
- Why it improves the code
- Files changed
- Checks run
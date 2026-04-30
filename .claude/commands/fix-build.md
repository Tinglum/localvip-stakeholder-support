# /fix-build

Fix the current build failure.

## Steps

1. Run the build command
2. Identify the first real error
3. Inspect relevant files
4. Fix the root cause
5. Re-run the build
6. Stop when build passes or when a new unrelated failure appears

## Rules

- Do not make broad rewrites
- Do not guess blindly
- Do not fix downstream symptoms before root cause
- Keep changes minimal

## Output

Return:
- Error found
- Root cause
- Files changed
- Verification result
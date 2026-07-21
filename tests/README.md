# Hidden test cases

Each challenge's graded tests live in `tests/<slug>/` as numbered pairs:

```
tests/2026-07-20-chefs-candy-distribution/
  1.in   1.out
  2.in   2.out
  ...
```

- `<n>.in` is fed to the submission on stdin; `<n>.out` is the expected stdout.
- Tests run in numeric order; grading stops at the first failure.
- Output is compared after trimming trailing whitespace per line and trailing
  blank lines.

**These files are git-ignored** (everything except this README) — hidden tests
must never be committed to a repo solvers can read. Keep them locally in dev; in
production they'd come from a private store. Only this README is tracked so the
format is documented.

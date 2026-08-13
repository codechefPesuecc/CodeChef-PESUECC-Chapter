<!--
  Thanks for contributing! Please fill this out so reviewers can understand and
  test your change quickly. See CONTRIBUTING.md for the full guidelines.
-->

## Summary

<!-- What does this PR do, and why? One or two sentences is fine. -->

## Type of change

<!-- Put an "x" in the boxes that apply. -->

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that changes existing behaviour)
- [ ] New / updated problem (challenge JSON)
- [ ] Documentation only
- [ ] Chore / refactor / tooling

## Related issues

<!-- e.g. "Closes #12" so the issue auto-closes on merge. -->

Closes #

## How was this tested?

<!--
  Describe how you verified the change. For UI changes, add before/after
  screenshots (light AND dark mode where relevant).
-->

## Checklist

- [ ] I ran the checks locally on **Node 22** and they pass: `npx tsc --noEmit`, `npm run lint`, `npm run test`, `npm run build`
- [ ] I did **not** commit unrelated `package-lock.json` changes (see CONTRIBUTING.md - the native-binding gotcha)
- [ ] My change is focused and single-purpose
- [ ] I added / updated tests where it made sense
- [ ] I updated documentation where needed
- [ ] For UI changes: it looks correct in **both light and dark mode**
- [ ] For problems: `npm run challenges:validate` passes and hidden `tests` are strong
- [ ] I did not commit any secrets

## Notes for reviewers

<!-- Anything specific you want reviewers to look at, or known limitations. -->

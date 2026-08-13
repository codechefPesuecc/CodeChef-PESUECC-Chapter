# Security Policy

The CodeChef PESUECC Chapter platform runs untrusted, user-submitted code and stores student
account data, so we take security seriously. Thank you for helping keep the platform and its users
safe.

---

## Supported versions

This is a continuously deployed application — there is a single production deployment tracking the
`main` branch, and there are no long-lived release versions. Security fixes are always applied to
`main` and deployed forward.

| Version | Supported |
| --- | --- |
| `main` (production) | Yes |
| Any older commit / fork | No |

---

## Reporting a vulnerability

**Please do not open a public issue, pull request, or discussion for a security vulnerability.** A
public report tells everyone about the hole before we can close it.

Instead, report it privately through **either** of these channels:

1. **GitHub private vulnerability reporting** (preferred) — go to the
   [**Security** tab](https://github.com/codechefPesuecc/CodeChef-PESUECC-Chapter/security) and click
   **"Report a vulnerability"**. This opens a private advisory visible only to you and the
   maintainers.
2. **Email** — write to **`codechef.ecc@pes.edu`** with the subject line prefixed `SECURITY:`.

Please include as much of the following as you can:

- A clear description of the vulnerability and its **potential impact** (what an attacker could do).
- **Step-by-step reproduction** instructions, and ideally a minimal proof of concept.
- The affected URL, endpoint, or file, and the commit / environment where you observed it.
- Any suggested remediation, if you have one.

Even a partial report is useful — if something looks wrong but you are not certain, tell us anyway.

---

## What to expect

- **Acknowledgement:** we aim to respond within **72 hours** to confirm we received your report.
- **Assessment:** we will investigate, confirm the issue, and keep you updated on our progress.
- **Fix & disclosure:** once a fix is deployed, we are happy to publicly credit you for the report
  (with your permission). We ask that you give us a reasonable window to remediate before any public
  disclosure.

Because this platform is run by student volunteers, response times are best-effort — thank you for
your patience.

---

## Scope

Security-relevant areas of the platform include, but are not limited to:

- **Authentication & sessions** — login, registration, OTP email verification, password reset,
  session tokens.
- **The code judge sandbox** — any way to break out of the sandbox, execute code on our
  infrastructure, exhaust resources, or reach internal services from submitted code.
- **Hidden test cases** — any way for a solver to read the hidden `tests` for a problem.
- **Leaderboard & submissions** — any way to forge a verdict, inflate a rank, or tamper with another
  user's data.
- **Account data** — any unauthorized access to another user's email, SRN/PRN, or profile.
- **Injection / XSS / CSRF** and similar classic web vulnerabilities.

### Please do not

- Access, modify, or delete data that does not belong to you beyond the minimum needed to demonstrate
  the issue.
- Run automated scanners, brute-force, or denial-of-service attacks against the live platform.
- Publicly disclose the issue before we have had a chance to fix it.

Good-faith security research conducted within these guidelines is welcome and appreciated, and we
will not pursue action against researchers who follow this policy.

---

## Note: security bugs vs. cheating

Reporting a genuine vulnerability so we can fix it is exactly what we want. **Exploiting** a
weakness — cheating in a contest, extracting hidden tests to gain an advantage, or manipulating the
leaderboard — is a different thing entirely and is a violation of our
[Code of Conduct](./CODE_OF_CONDUCT.md) (see *Academic & Competitive Integrity*). When in doubt,
report it privately and let us fix it.

---

*Maintained by the CodeChef PESUECC Chapter core team. Last reviewed: August 2026.*

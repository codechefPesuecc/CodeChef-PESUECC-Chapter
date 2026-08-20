# Monstr Platform E2E Test Plan

## Test Environment
- **Admin Account**: username=admin, password=fortheloveofcode, email=admin@codechef.pesu.edu
- **Teacher Account**: username=dummyteacher, password=TestPassword123, email=dummy.teacher@pesu.edu
- **Student Account**: username=testuser, password=TEST_PASSWD, email=test@example.com, SRN=PES2023CS001

## TEST FLOW

### Phase 1: Admin & Teacher Setup (5 min)
- [ ] Login as admin@codechef.pesu.edu / fortheloveofcode
- [ ] Navigate to /admin → Teachers
- [ ] Verify dummyteacher is listed as promoted teacher
- [ ] Logout

### Phase 2: Teacher Contest Creation (10 min)
- [ ] Login as dummyteacher / TestPassword123
- [ ] Go to /monstr/teacher
- [ ] Click "Create New Contest"
- [ ] Fill form:
  - **Title**: "Test Contest"
  - **Duration**: 5 minutes
  - **Languages**: C++, Python
  - **Problem 1**:
    - Title: "Hello World"
    - Statement: "Print 'Hello, World!'"
    - Input Format: "None"
    - Output Format: "Single line with text"
    - Constraints: "None"
    - Sample Input: ""
    - Sample Output: "Hello, World!"
    - Hidden Test Input: ""
    - Hidden Test Output: "Hello, World!"
    - Checker: Token
  - [ ] Import a sample problem using JSON (optional)
- [ ] Click "Create Contest"
- [ ] Verify contest page loads
- [ ] Copy join code (note it)
- [ ] Verify QR code displays
- [ ] Click "Start Contest"
- [ ] Verify contest started banner appears

### Phase 3: Student Join & Work (15 min)
- [ ] Logout from teacher account
- [ ] Login as testuser / TEST_PASSWD
- [ ] Go to /monstr
- [ ] Paste join code and submit
- [ ] Verify redirected to contest workspace
- [ ] Verify:
  - [ ] Timer counting down (5:00 → 4:59...)
  - [ ] Problem statement visible
  - [ ] Input/Output/Constraints sections render
  - [ ] Samples display
  - [ ] Language dropdown shows C++ and Python only
  - [ ] Code editor loads
- [ ] Write sample solution:
  ```cpp
  #include <iostream>
  using namespace std;
  int main() {
    cout << "Hello, World!" << endl;
    return 0;
  }
  ```
- [ ] Click "Run" with sample input
- [ ] Verify output shows "Hello, World!"
- [ ] Click "Submit"
- [ ] Verify:
  - [ ] Submission accepted
  - [ ] Verdict shows "AC" (Accepted)
  - [ ] Submit button disabled after timer expires
  - [ ] Run button still works after time expires

### Phase 4: Teacher Monitoring (5 min)
- [ ] Switch back to teacher browser/tab
- [ ] Refresh /monstr/teacher/contests/[id]
- [ ] Verify "Live Participants" section shows
- [ ] Verify testuser listed with "AC (1)" status for Problem 1
- [ ] Click "Download Excel Results"
- [ ] Verify Excel file downloads with:
  - [ ] Headers: Username, Name, SRN, Problems Solved, P1 (Verdict + count)
  - [ ] Row: testuser, [name], PES2023CS001, 1, AC (1)

### Phase 5: Security Verification (5 min)
- [ ] Try accessing `/monstr/contest/[id]` before contest starts - should redirect to /monstr
- [ ] Try joining contest without verified email - should get 403
- [ ] Try joining contest without SRN - should get 403
- [ ] Try running code with unauthorized language - should get 400
- [ ] Try submitting after contest ends - should get 403 with "contestEnded: true"

### Phase 6: Edge Cases (5 min)
- [ ] Switch problems mid-submission (verify code doesn't get clobbered)
- [ ] Switch languages and verify code saved per language
- [ ] Open QR code in new window (should auto-join if logged in)
- [ ] Check localStorage for saved code: `monstr:code:{contestId}:{problemId}:{language}`

## EXPECTED OUTCOMES

| Test | Expected | Status |
|------|----------|--------|
| Admin login | Authenticated | ⚠️ TBD |
| Teacher contest creation | Contest created with join code | ⚠️ TBD |
| Student joins via code | Redirected to workspace | ⚠️ TBD |
| Run code | Output displayed | ⚠️ TBD |
| Submit during contest | AC verdict stored | ⚠️ TBD |
| Submit after contest | 403 error | ⚠️ TBD |
| Monitoring page | Live participants shown | ⚠️ TBD |
| Export results | Excel file with correct data | ⚠️ TBD |
| Security: pre-start access | Redirected to /monstr | ⚠️ TBD |
| Security: no email verify | 403 error | ⚠️ TBD |
| Security: no SRN | 403 error | ⚠️ TBD |
| Security: wrong language | 400 error | ⚠️ TBD |

## KNOWN ISSUES (FIXED)
- ✅ Hidden test data was leaking to students (FIXED: column projection now)
- ✅ Problem statements visible before contest starts (FIXED: added startedAt check)
- ✅ Run endpoint had no auth (FIXED: now requires auth + participant verification)
- ✅ Best verdict was actually last submission (FIXED: now prefers AC verdicts)
- ✅ Student got stuck on "Contest ended" after teacher started (FIXED: serverEndsAt now updates)
- ✅ Code got clobbered when switching problems (FIXED: code now loads before switch)
- ✅ Input/Output/Constraints didn't render (FIXED: now visible in workspace)
- ✅ Problems not sorted by orderIndex (FIXED: added orderBy to all queries)

## CONFIGURATION

### Environment Variables Needed
```env
NEXT_PUBLIC_APP_URL=localhost:3000  # or production domain
```

### Database State
- Admin user: admin@codechef.pesu.edu (created via script)
- Teacher user: dummyteacher (email verified, promoted to teacher)
- Student user: testuser (email verified, SRN set)

## POST-TEST CHECKLIST
- [ ] All tests pass
- [ ] No console errors in browser DevTools
- [ ] No SQL errors in server logs
- [ ] Performance acceptable (< 2s page loads)
- [ ] Mobile responsive
- [ ] Dark mode works

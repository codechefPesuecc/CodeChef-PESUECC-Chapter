/**
 * Builds the CodeChef PESUECC recruitment Google Form.
 *
 * HOW TO RUN
 *   1. Go to script.google.com → New project
 *   2. Paste this whole file in, replacing the default Code.gs contents
 *   3. Edit the CONFIG block below (SITE_URL especially)
 *   4. Run → createRecruitmentForm, and authorise it when prompted
 *   5. The Execution log prints the form URL, its edit URL and the responses sheet
 *   6. Paste the form URL into /admin/recruitment on the site
 *
 * Re-running creates a brand new form; it never edits an existing one. To change
 * questions on a live form, edit the form directly — otherwise you orphan the
 * responses already collected.
 *
 * DESIGN NOTES (why the questions look like this)
 *   - No 1-5 self-rating scales. Everyone picks 4; they carry no information.
 *   - Links and handles over self-description, because those can be checked.
 *   - Every domain section ends with one small real task rather than a question
 *     about past work. That single answer does more shortlisting than the rest.
 *   - Word caps in the help text, because someone has to read 200 of these.
 */

/**
 * THEMING — must be done by hand, not here.
 *
 * Apps Script exposes no theming API (nor does the Forms REST API): colour, font
 * and header image are editor-only settings. And more to the point, a Google Form
 * has ONE theme — it does not follow the viewer's dark-mode preference, so it
 * renders light for everyone regardless of which mode the site is in. There is no
 * "match both modes" available; you pick one look and everybody sees it.
 *
 * That is why /join wraps the embed in a white card: it makes the always-light
 * form read as an intentional panel in dark mode instead of a broken patch.
 *
 * To match the site's accent, in the form editor click the palette icon and set:
 *
 *   Theme colour       #a67c52   (--color-bronze, light mode)
 *   Background         white, or the lightest tint Google offers
 *   Header font        Playful / "Decorative" is closest to the site's display face
 *
 * Site tokens, for reference:
 *   light   cream #f5f1eb · chocolate #3e2f24 · bronze #a67c52 · panel #ffffff
 *   dark    bronze #bd8a4a · chocolate #f7f0e6 · panel #221a12 · canvas #16110c
 *
 * Use the LIGHT-mode bronze (#a67c52). The form always sits on a white card, so
 * the dark-mode bronze (#bd8a4a) is tuned for a dark background and reads washed
 * out here.
 */

// ─── CONFIG — edit these ────────────────────────────────────────────────────
const CONFIG = {
  // The live site. Change this if the chapter moves to a custom domain.
  SITE_URL: 'https://codechef.pesuecc.workers.dev',
  CYCLE: '2026-27',
  TITLE: 'CodeChef PESUECC Chapter — Recruitments 2026-27',
  CONTEST_PRIZE: 'Rs 5,000',
  SPONSOR_AMOUNT: 'Rs 20,000',
};

// The six domains. These MUST stay in sync with the list on /join — an applicant
// reading a domain on the site and not finding it here is the exact failure we
// had to fix once already.
const DOMAINS = [
  'Competitive Programming',
  'Design',
  'Events',
  'Technical',
  'Sponsorship',
  'Social Media & Marketing',
];

// ─── Entry point ────────────────────────────────────────────────────────────
function createRecruitmentForm() {
  const form = FormApp.create(CONFIG.TITLE);

  form.setDescription(
    'Takes about 10 minutes. Answer in your own words — we read every response, ' +
    'and AI-written answers are obvious and do not help you. There are no wrong ' +
    'answers; we are looking for how you think, not what you already know.'
  );

  // Sign-in is required by the one-response limit. Response editing is on so a
  // typo in an SRN does not mean an applicant is locked out and you are fixing
  // it by hand in the sheet.
  form.setLimitOneResponsePerUser(true);
  form.setAllowResponseEdits(true);
  form.setProgressBar(true);
  form.setConfirmationMessage(
    'Application received. We read every response — if you are shortlisted we ' +
    'will email you about what comes next, so keep an eye on your spam folder too.'
  );

  // Verified collection ties the response to the signed-in Google account.
  // setEmailCollectionType is newer; fall back on older runtimes.
  try {
    form.setEmailCollectionType(FormApp.EmailCollectionType.VERIFIED);
  } catch (e) {
    form.setCollectEmail(true);
  }

  // ── Section 1 — About you (first page, no page break needed) ──────────────
  text(form, 'Full name', '', true);
  text(form, 'SRN', 'Leave blank if yours has not been assigned yet.', false);
  text(form, 'PRN', '', true);
  choice(form, 'Year of study', ['1st', '2nd', '3rd', '4th'], '', true);
  text(form, 'Branch', '', true);
  text(form, 'Phone number', 'WhatsApp preferred.', true);

  // The one field that matters structurally: it is the only link between a
  // response and a real account on the site. Verified email does NOT replace it —
  // that captures a personal Gmail, which usually is not the address on their
  // Arena account.
  text(
    form,
    'Your Arena username',
    'Your username on our platform. Do not have one? Register at ' +
      CONFIG.SITE_URL + '/register first, then come back. We use this to link ' +
      'your application to your account.',
    true
  );

  choice(
    form,
    'How did you hear about us?',
    ['Instagram', 'A friend or senior', 'Class announcement', 'Our website', 'Other'],
    '',
    false
  );

  // ── Section 2 — Domain choice ─────────────────────────────────────────────
  form.addPageBreakItem()
    .setTitle('Your domain')
    .setHelpText('Pick the one you would be most excited to work on.');

  const domainQuestion = form.addMultipleChoiceItem()
    .setTitle('Which domain are you applying for?')
    .setRequired(true);

  // ── Sections 3-8 — one per domain ─────────────────────────────────────────
  // Built in DOMAINS order so the branching targets line up with the question.
  const pages = {};

  pages['Competitive Programming'] = section(form, 'Competitive Programming');
  text(form, 'Your handles: CodeChef / Codeforces / LeetCode',
    'Paste profile links or usernames. Write "none yet" if you are just starting.', true);
  choice(form, 'Roughly how many problems have you solved overall?',
    ['Under 20', '20-100', '100-300', '300+'], '', true);
  text(form, 'Which topic do you know you are weakest at?',
    'Honest answers are better than impressive ones.', true);
  choice(form, 'Would you be interested in setting problems for our contests?',
    ['Yes', 'Maybe later', 'No'], '', false);
  para(form, 'Link one problem you solved, and explain your approach',
    'Explain it in 4-6 sentences, as if to someone who has not seen the problem. 120 words max.', true);

  pages['Design'] = section(form, 'Design');
  text(form, 'Portfolio, Behance, Dribbble or Instagram link',
    'A Google Drive folder of your work is fine too — we just need to see something.', true);
  checks(form, 'Tools you use',
    ['Figma', 'Canva', 'Photoshop', 'Illustrator', 'Premiere / After Effects', 'Blender', 'Other'], '');
  para(form, 'Link one piece you made, and tell us what you would change about it today',
    'Being able to critique your own work matters more to us than a polished portfolio. 100 words max.', true);

  pages['Events'] = section(form, 'Events');
  para(form, 'Describe one event you helped run — your specific role, not the team’s',
    'Write "none yet" if this would be your first; that is genuinely fine. 100 words max.', true);
  choice(form, 'Hours per week you can realistically give',
    ['1-2', '3-5', '6-10', 'More than 10'], '', true);
  para(form, 'It is 10 minutes before a workshop for 60 people and the projector dies. What do you do?',
    'Walk us through it. 100 words max.', true);

  pages['Technical'] = section(form, 'Technical');
  text(form, 'GitHub profile link', '', true);
  checks(form, 'What do you work with?',
    ['HTML/CSS', 'JavaScript', 'React / Next.js', 'Python', 'Node / backend', 'Databases',
     'Docker / DevOps', 'C++ / Java', 'Git', 'None of these yet'], '');
  choice(form, 'What interests you most?',
    ['Frontend', 'Backend', 'Infrastructure and tooling', 'Everything', 'Not sure yet'], '', true);
  para(form, 'Link one thing you built, and describe the hardest bug you hit in it',
    'How did you track it down? The bug matters more than the project — a small thing you truly ' +
    'debugged beats a big one you followed a tutorial for. 120 words max.', true);

  pages['Sponsorship'] = section(form, 'Sponsorship');
  para(form, 'Any outreach, sponsorship, PR or sales experience?',
    'Write "none yet" if not — we are happy to train. 100 words max.', false);
  para(form, 'Have you ever cold-emailed or cold-called a stranger to ask for something? What happened?',
    '80 words max.', false);
  para(form, 'Write the cold email you would send to a local company asking them to sponsor a ' +
    CONFIG.SPONSOR_AMOUNT + ' hackathon prize pool',
    'Write the actual email, not a description of it. 150 words max.', true);

  pages['Social Media & Marketing'] = section(form, 'Social Media & Marketing');
  text(form, 'Link a page you run, or content you have made',
    'Your own account, a club page, posts, reels, articles — anything you made.', true);
  checks(form, 'What are you comfortable with?',
    ['Instagram', 'LinkedIn', 'X / Twitter', 'Canva / graphics', 'Video editing',
     'Copywriting', 'Analytics and insights'], '');
  para(form, 'Write an Instagram caption announcing a 3-hour beginner-friendly coding contest with a ' +
    CONFIG.CONTEST_PRIZE + ' prize pool',
    'Max 60 words.', true);
  para(form, 'How would you get 100 first-years to actually show up to a beginner workshop?',
    '"Post on Instagram" is not an answer — tell us what the post says, where else you would go, ' +
    'and when. 100 words max.', true);

  // ── Final section — everyone lands here ───────────────────────────────────
  const finalPage = form.addPageBreakItem().setTitle('Wrapping up');

  para(form, 'What do you want to have built, learned or won by the end of this year with us?',
    'Specific beats impressive. "Reach 1400 on Codeforces" tells us more than "grow as a ' +
    'developer". 100 words max.', true);
  text(form, 'Are you part of other clubs or committees? Which ones?',
    'Not a filter — we just want to know your real availability.', false);
  para(form, 'Anything else we should see? Resume, portfolio, links.', '', false);

  // ── Wire up the branching ─────────────────────────────────────────────────
  // Without this, someone who picks Competitive Programming falls straight through
  // into the Design questions. This is THE thing to verify after running.
  DOMAINS.forEach(function (name) {
    pages[name].setGoToPage(finalPage);
  });

  domainQuestion.setChoices(
    DOMAINS.map(function (name) {
      return domainQuestion.createChoice(name, pages[name]);
    })
  );

  // ── Responses spreadsheet ─────────────────────────────────────────────────
  const sheet = SpreadsheetApp.create(CONFIG.TITLE + ' (Responses)');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, sheet.getId());

  Logger.log('─────────────────────────────────────────────');
  Logger.log('Form URL (paste this into /admin/recruitment):');
  Logger.log(form.getPublishedUrl());
  Logger.log('');
  Logger.log('Edit the form:   ' + form.getEditUrl());
  Logger.log('Responses sheet: ' + sheet.getUrl());
  Logger.log('─────────────────────────────────────────────');
  Logger.log('BEFORE SHARING: submit one test response per domain and confirm a');
  Logger.log('Competitive Programming applicant never sees the Design questions.');
}

// ─── Small helpers, so the section definitions above stay readable ──────────
function section(form, title) {
  return form.addPageBreakItem().setTitle(title);
}

function text(form, title, help, required) {
  const item = form.addTextItem().setTitle(title).setRequired(!!required);
  if (help) item.setHelpText(help);
  return item;
}

function para(form, title, help, required) {
  const item = form.addParagraphTextItem().setTitle(title).setRequired(!!required);
  if (help) item.setHelpText(help);
  return item;
}

function choice(form, title, options, help, required) {
  const item = form.addMultipleChoiceItem().setTitle(title).setRequired(!!required);
  item.setChoiceValues(options);
  if (help) item.setHelpText(help);
  return item;
}

function checks(form, title, options, help) {
  const item = form.addCheckboxItem().setTitle(title);
  item.setChoiceValues(options);
  if (help) item.setHelpText(help);
  return item;
}

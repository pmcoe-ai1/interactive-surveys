# Sprint 1 Review Report
**Date:** 2026-04-16  
**Reviewer:** Claude (automated review agent)  
**Test run:** 61 passed / 0 failed across 4 suites

---

## SCENARIO COVERAGE

| Scenario ID | Story    | Test file                   | Test name (abbrev.)                                                   | Result  |
|-------------|----------|-----------------------------|-----------------------------------------------------------------------|---------|
| SC0.1.1     | S0.1     | infrastructure.test.ts      | package.json lists next/tailwindcss; prisma schema exists with postgresql; defines User/Survey/Question | PASS    |
| SC0.1.2     | S0.1     | infrastructure.test.ts      | package.json has "dev" script referencing next; next is a production dep | PASS    |
| SC0.1.3     | S0.1     | infrastructure.test.ts      | tsconfig strict mode, @/* alias, modern target                        | PASS    |
| SC0.2.1     | S0.2     | —                           | *Cloud infra: Railway provisioning (untestable in CI)*                | NO TEST |
| SC0.2.2     | S0.2     | —                           | *Cloud infra: Railway deploy connects to PostgreSQL (untestable)*     | NO TEST |
| SC0.2.3     | S0.2     | infrastructure.test.ts      | Express /health returns 200 with database=connected (smoke test proxy) | PASS ⚠ |
| SC0.3.1     | S0.3     | —                           | *Cloud infra: GitHub → Railway auto-build (untestable)*               | NO TEST |
| SC0.3.2     | S0.3     | —                           | *Cloud infra: visit Railway URL shows app (untestable)*               | NO TEST |
| SC0.3.3     | S0.3     | —                           | *Cloud infra: build error → previous version live (untestable)*       | NO TEST |
| SC0.4.1     | S0.4     | infrastructure.test.ts      | all required tables exist after migration; /health confirms connected  | PASS    |
| SC0.4.2     | S0.4     | infrastructure.test.ts      | second prisma migrate deploy exits 0                                  | PASS    |
| SC0.4.3     | S0.4     | —                           | *Migration failure → deploy fails (no test)*                          | NO TEST |
| SC8.1.1     | S8.1     | auth.test.ts                | VerificationToken created; User upserted on magic-link click           | PASS    |
| SC8.1.2     | S8.1     | auth.test.ts                | User created with authProvider=google; Account record linked           | PASS    |
| SC8.1.3     | S8.1     | auth.test.ts                | check-email returns existing user; returns null for unregistered       | PASS    |
| SC8.2.1     | S8.2     | auth.test.ts                | VerificationToken stored with future expiry                            | PASS    |
| SC8.2.2     | S8.2     | auth.test.ts                | Session created linked to user after verification                      | PASS    |
| SC8.2.3     | S8.2     | auth.test.ts                | User with authProvider=github; Account linked                          | PASS    |
| SC8.3.1     | S8.3     | auth.test.ts                | 5 surveys returned with title/status/updatedAt/_count.responses        | PASS    |
| SC8.3.2     | S8.3     | auth.test.ts                | empty array returned when user has no surveys                          | PASS    |
| SC8.3.3     | S8.3     | auth.test.ts                | survey retrievable by id+userId; questions array included              | PASS    |
| SC8.4.1     | S8.4     | auth.test.ts                | session deleted; subsequent lookup returns null                        | PASS    |
| SC8.4.2     | S8.4     | auth.test.ts                | middleware covers /dashboard and /surveys; route source contains 401   | PASS    |
| SC8.4.3     | S8.4     | auth.test.ts                | session stored with past expires timestamp                             | PASS    |
| SC1.1.1     | S1.1     | surveys.test.ts             | survey persisted with title/slug; retrievable by creator               | PASS    |
| SC1.1.2     | S1.1     | surveys.test.ts             | Prisma rejects missing title; route source contains "Title is required"/400 | PASS    |
| SC1.1.3     | S1.1     | surveys.test.ts             | route source contains getServerSession/Unauthorized/401; middleware covers /surveys | PASS    |
| SC1.2.1     | S1.2     | surveys.test.ts             | short_text question at order 0; subsequent questions increment order   | PASS    |
| SC1.2.2     | S1.2     | surveys.test.ts             | all 10 QuestionType values in schema; one of each persisted to DB      | PASS    |
| SC1.2.3     | S1.2     | surveys.test.ts             | threshold constant is 12; count ≥ threshold triggers warning; count < 12 does not | PASS    |
| SC2.1.1     | S2.1     | questions.test.ts           | Answer linked to question+response; completing response sets status=complete | PASS    |
| SC2.1.2     | S2.1     | questions.test.ts           | email ValidationRule stored on question; all 4 enum values persist     | PASS    |
| SC2.1.3     | S2.1     | questions.test.ts           | placeholder stored; defaults to null when omitted                      | PASS    |
| SC2.3.1     | S2.3     | questions.test.ts           | 4 QuestionOptions created; selectedOptions JSON stored                 | PASS    |
| SC2.3.2     | S2.3     | questions.test.ts           | option.order maps to keyboard index; order=1 → key "2"                 | PASS    |
| SC2.3.3     | S2.3     | questions.test.ts           | allowOther=true stored; custom text saved in Answer.value              | PASS    |
| SC2.6.1     | S2.6     | questions.test.ts           | yes_no question created; "yes" Answer stored                           | PASS    |
| SC2.6.2     | S2.6     | questions.test.ts           | Answer accepts "yes" and "no" string values                            | PASS    |
| SC2.6.3     | S2.6     | questions.test.ts           | Answer updated from "yes" to "no"                                      | PASS    |
| SC2.9.1     | S2.9     | questions.test.ts           | welcome_screen with title+description; returned first when ordered     | PASS    |
| SC2.9.2     | S2.9     | questions.test.ts           | custom buttonLabel stored; defaults to null                            | PASS    |
| SC2.9.3     | S2.9     | questions.test.ts           | welcome at order 0; first real question at order 1; ctaUrl stored      | PASS    |

**Coverage summary:** 35 PASS · 7 NO TEST (SC0.2.1/2, SC0.3.1/2/3 cloud-infra untestable; SC0.4.3 missing; SC0.2.3 covered via proxy smoke test)

---

## FINDINGS

### 1. [HIGH] Draft surveys accept respondent submissions — BRD violation

**File:** `src/app/api/s/[slug]/responses/route.ts:15`

```typescript
if (survey.status !== 'live' && survey.status !== 'draft') {
  return NextResponse.json({ error: 'Survey is closed' }, { status: 403 });
}
```

This logic accepts responses on **draft** surveys. BRD glossary G15 ("Draft") explicitly states: *"respondents cannot submit responses to a draft survey in production."* The correct guard is `survey.status !== 'live'`. The RESPONSE_SURVEY_CLOSED error (403) should be returned for both `draft` and `closed` statuses.

---

### 2. [HIGH] 17 of 19 BRD error codes have no automated test

Only `UNAUTHORIZED` (401) and `SURVEY_TITLE_REQUIRED` (400) are exercised, and both via source-text assertions rather than live HTTP calls. The following 17 codes are defined in `brd-skeleton.yaml` `errorCodes` with no test coverage:

`HEALTH_DB_ERROR` · `SURVEY_NOT_FOUND` · `SURVEY_UPDATE_FAILED` · `SURVEY_DELETE_FAILED` · `SURVEY_CREATE_FAILED` · `QUESTION_TYPE_REQUIRED` · `QUESTION_TYPE_INVALID` · `QUESTION_REORDER_INVALID` · `QUESTION_ADD_FAILED` · `QUESTION_UPDATE_FAILED` · `QUESTION_DELETE_FAILED` · `RESPONSE_SURVEY_NOT_FOUND` · `RESPONSE_SURVEY_CLOSED` · `ANSWER_QUESTION_REQUIRED` · `ANSWER_SAVE_FAILED` · `RESPONSE_NOT_FOUND` · `RESPONSE_COMPLETE_FAILED`

---

### 3. [HIGH] Hardcoded `NEXTAUTH_SECRET` fallback is in public source

**File:** `src/lib/auth.ts:70`

```typescript
secret: process.env.NEXTAUTH_SECRET || 'dev-secret-change-in-production',
```

The fallback string is committed to the repository. If `NEXTAUTH_SECRET` is unset at deploy time, Railway silently uses this known value and any party with repo access can forge valid session tokens. The line should throw at startup rather than fall back.

---

### 4. [MEDIUM] SC0.4.3 (migration failure → deploy rollback) has no test

`sprint-1.yaml` lists this as a `failure` scenario but `infrastructure.test.ts` only covers SC0.1.x, SC0.4.1, SC0.4.2. The comment notes Railway cloud scenarios "cannot be exercised" but does not mention SC0.4.3 specifically. There is no test — not even a source or config assertion — that confirms the deploy pipeline is configured to abort on migration failure.

---

### 5. [MEDIUM] `GET /api/surveys` missing try/catch — unhandled DB failure

**File:** `src/app/api/surveys/route.ts:12`

```typescript
const surveys = await getUserSurveys(session.user.id);
return NextResponse.json(surveys);
```

`getUserSurveys()` is not wrapped in try/catch. A database outage causes Next.js to return an unstructured 500 with no JSON body, violating the API contract and potentially leaking stack traces. The same gap exists at `GET /api/surveys/[id]/route.ts:16` (`getSurveyById`), though that call is lower-risk because it returns `null` rather than throwing on "not found."

---

### 6. [MEDIUM] `POST /api/s/[slug]/responses` missing try/catch around `createResponse()`

**File:** `src/app/api/s/[slug]/responses/route.ts:22`

```typescript
const response = await createResponse(survey.id, fingerprint ?? undefined);
return NextResponse.json(response, { status: 201 });
```

A transient DB failure here throws an unhandled error. The BRD defines `RESPONSE_COMPLETE_FAILED` and `ANSWER_SAVE_FAILED` for graceful failure, but there is no try/catch to map it.

---

### 7. [MEDIUM] `GET /api/surveys/[id]/questions` catch block unconditionally returns 404

**File:** `src/app/api/surveys/[id]/questions/route.ts:20-23`

```typescript
} catch (err) {
  const message = err instanceof Error ? err.message : 'Failed to fetch questions';
  return NextResponse.json({ error: message }, { status: 404 });
}
```

`getQuestions()` only throws `'Survey not found'`, so 404 is correct in that case. But any generic DB failure (e.g., connection timeout) also returns 404, which is incorrect. The other route handlers correctly branch on `message === 'Survey not found' ? 404 : 400`; this one does not.

---

### 8. [MEDIUM] Response route bypasses service layer — direct Prisma call

**File:** `src/app/api/s/[slug]/responses/route.ts:10`

```typescript
const survey = await prisma.survey.findUnique({ where: { slug: params.slug } });
```

`getSurveyBySlug()` already exists in `src/services/survey.service.ts:65` and performs the same query. The route imports `prisma` directly instead. This duplicates query logic and means the response route won't benefit from any future caching or filtering added to the service.

---

### 9. [MEDIUM] `body.validation` not validated before reaching Prisma

**File:** `src/app/api/surveys/[id]/questions/route.ts:53`

```typescript
validation: body.validation,
```

The `type` field is checked against `Object.values(QuestionType)` but `validation` is passed through without checking it against `ValidationRule` enum values (`none | email | url | number`). An invalid value (e.g., `"phone"`) causes Prisma to throw a runtime error that is caught and returned as a generic 400, rather than a clean QUESTION_TYPE_INVALID-style response.

---

### 10. [MEDIUM] SC0.2.x / SC0.3.x not marked as manually verified in sprint artefacts

Six scenarios (SC0.2.1, SC0.2.2, SC0.2.3, SC0.3.1, SC0.3.2, SC0.3.3) appear in `sprint-1.yaml` but have no automated test and no manual-verification record. `infrastructure.test.ts` documents the exclusion in a comment, but the sprint plan itself carries no "manual only" annotation and the definition of done does not record a deployment smoke test pass. SC0.2.3 is partially proxied by the `/health` endpoint test but only against a local Testcontainer database, not a Railway-provisioned instance.

---

### 11. [LOW] `MultipleChoiceQuestion` useEffect missing deps — stale closure risk

**File:** `src/components/questions/MultipleChoiceQuestion.tsx:39-52`

```typescript
}, [selected, sortedOptions]);
```

`submit()` captured in the handler depends on `showOther`, `otherText`, `required`, `minSelections`, and `onAnswer`, none of which are in the dependency array. If the user types into the "Other" text field and immediately presses Enter via keyboard, the handler may execute with stale `otherText`. React's exhaustive-deps rule would flag this.

---

### 12. [LOW] Question counter includes welcome and thank-you screens

**File:** `src/components/OqaatSurvey.tsx:335`

```tsx
{currentIndex + 1} / {sortedQuestions.length}
```

`sortedQuestions` includes `welcome_screen` and `thank_you_screen` nodes. A survey with 1 welcome + 3 questions + 1 thank-you = 5 total shows "2/5" when the respondent is on the first real question. BRD F3 specifies a "progress indicator" but does not define whether screens count toward the total; clarification is needed.

---

### 13. [LOW] Silent answer loss on network error in OQAAT flow

**File:** `src/components/OqaatSurvey.tsx:81-100`

`saveAnswer()` makes a fetch call with no try/catch and no loading/error state. If the call fails, the answer is silently dropped and the UI advances to the next question. The respondent receives no feedback that their response was not recorded.

---

### 14. [LOW] `generateSlug` duplicated in test file — divergence risk

**File:** `tests/sprint-1/surveys.test.ts:32-41` re-implements the slug generator that already exists in `src/services/survey.service.ts:18-27`. If the production algorithm changes (e.g., to add collision-retry logic), the tests will continue to pass against the old logic.

---

## SUMMARY

Sprint 1 is technically green — all 61 tests pass and the core scaffold, authentication, survey creation, question persistence, and OQAAT respondent components are in place. The keyboard navigation across all 10 question types is implemented and the 200 ms transitions are within the BRD-specified 200–300 ms window. However, three issues require attention before Sprint 2 builds on this foundation. **Finding 1 is a correctness bug**: draft surveys silently accept public responses, contradicting BRD glossary G15 and potentially exposing incomplete surveys to respondents. **Finding 3 is a latent security risk**: the hardcoded `NEXTAUTH_SECRET` fallback can be exploited if the environment variable is ever absent at deploy time. **Finding 2** is the most systemic gap: 17 of 19 BRD error codes have no test coverage, so error-path regressions will go undetected as the API surface grows in Sprints 2–3. The remaining medium findings (unguarded async calls in two route handlers, incorrect 404-for-all-errors in the questions GET handler, and the service-layer bypass in the responses route) are straightforward to fix and should be addressed before the response-collection epic (E5) lands.

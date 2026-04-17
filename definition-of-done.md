# Definition of Ready and Definition of Done

## Definition of Ready (story enters sprint when):

- Scenarios (Given/When/Then) defined and in Jira description
- Story points assigned
- Dependencies identified and satisfied (in completed or current sprint)
- Entity model covers this story's data needs

## Definition of Done (story is complete when):

- All scenarios pass as deterministic tests
- BRD sections for this story produced and validated
- Code compiles (`tsc --noEmit`)
- Route parity check passes (`node scripts/check-route-parity.js --sprint N`)
  - Every Express helper route has a matching Next.js `route.ts` file
  - Status codes are consistent between helper and real routes (bidirectional)
  - No inline `express()` stubs in test files outside `helpers/`
- Tests green (`npm test`)
- Demo completed and human signed off

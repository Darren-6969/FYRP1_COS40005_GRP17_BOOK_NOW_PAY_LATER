# Team Charter

# 1. Ownership

Each member owns a vertical slice from backend through to interface, rather than a technical layer. This means the person building a screen understands the data model behind it, and no one is blocked waiting for someone else to finish a layer.

| Member | Owns | Modules | Also accountable for |
| --- | --- | --- | --- |
| A | Backend architecture, finance, deployment | Platform, Identity, Payment, Settlement | Database schema and migrations, API contract, production cutover. Owns the critical path in week 1 |
| B | Listing vertical and customer experience | Catalogue, Inventory, Customer web | Feature flag mechanism, bulk listing import, concurrency test evidence |
| C | Order and credit vertical, operator experience | Booking, Risk, Promotion, Operator web | The credit tier evidence for the report |
| D | Infrastructure, chatbot, quality, administration | Notification, Chatbot, Admin web, Observability | Environments and CI, test coordination, product instrumentation |
| Darren | Team lead, client relationship, pilot readiness | None directly | Client decisions, operator recruitment, legal and tax items, support model, documentation |

> Two roles carry disproportionate risk. Member A blocks every Phase 1 task until the schema lands in week 1, which is why the migration is rehearsed rather than attempted live. Darren’s items in E15 depend on other people responding, so they start early even though they are not code.

> Ownership here is stated at module level. The story-by-story, week-by-week version of the same thing is in the Work Assignment Pack, and the live checklist is the "Plan <member>" sheet in the Development Backlog. If those three ever disagree, the backlog spreadsheet is correct, because it is the one that gets updated.

## 1.1 Module Boundary Rule

One table has one owning module. Cross-module access goes through the owner’s service interface. Cross-module writes happen only inside an orchestrator. If you need to query a table you do not own, you have found a missing service function, not a shortcut. The full rules are in SRS V2.3 section 6.2.2, and CI enforces them.

# 2. Definition of Done

A story is not done until every line below is true. "Done on my machine" is not a state that exists.

1. Every acceptance criterion in the story demonstrably passes
2. Unit tests written, and an integration test added if the story crosses a module boundary
3. The CI conformance check passes: no cross-module table access, no raw database client import outside the allowlist
4. Any API change is reflected in the OpenAPI contract
5. Reviewed and approved by one other member
6. Merged to staging and verified working in the staging environment
7. The Jira story is moved to Done by the person who wrote it, not by the reviewer

# 3. Working Agreements

## 3.1 Branches and Reviews

- One branch per story, named with the story key, for example BNPL-043-range-atomic-reservation
- Pull requests target staging. Only staging merges to main, and only after a green staging run
- Every pull request needs one approval. Reviewing is not optional work you fit in when convenient
- A pull request that has been open more than 24 hours is raised at standup
- Do not merge your own pull request, and do not approve without reading the acceptance criteria

## 3.2 Incomplete Work

- Unfinished features are merged behind a feature flag rather than held on a long-lived branch
- A branch older than one week is a problem to be discussed, not a normal state
- Never disable a lint rule or a failing test to get a merge through. If a rule is wrong, change the rule deliberately and tell the team

## 3.3 Communication

- Blocked for more than half a day means you raise it, in the group, immediately. Silence is the expensive option
- Decisions that affect another member’s module are made in the group, not in a direct message
- Client questions go through Darren so that Felix receives one voice, not four

# 4. Ceremonies

| Event | When | Length | Purpose |
| --- | --- | --- | --- |
| Standup | Three times weekly | 10 minutes | Yesterday, today, blocked. Not a status report to the lead |
| Backlog check | Monday | 20 minutes | Burndown against the phase plan, owner variance, reprioritisation |
| Sprint review with supervisor | Fortnightly | 30 minutes | Demonstrate working software, not slides |
| Week 4 checkpoint | End of week 4 | 45 minutes | The scope decision. See section 5 |
| Client update | Fortnightly, or when a decision is needed | 30 minutes | Progress, and the outstanding decisions from the Product Brief |
| Retrospective | End of each phase | 30 minutes | What to change in how we work, not what to build |

# 5. The Week 4 Checkpoint

This is the single most important meeting in the project, and its purpose is to make a scope decision while there is still time for it to help.

- Trigger: end of week 4, held regardless of how things are going
- Input: the backlog burndown, the owner variance column in the Phase Summary sheet, and the state of the Phase 1 backend
- Question: can Phase 2 realistically finish inside weeks 4 and 5 with the work remaining?
- Pre-agreed contingency if not: the chatbot backend, stories BNPL-052 to BNPL-054, moves to Phase 4. Nothing else depends on it and the rule engine alone can be demonstrated
- Second lever if that is not enough: promotion codes, the visual pricing editor, marketing reporting and saved listings come out of the pilot. Roughly nine days, none of them needed for a booking to work end to end
- The decision is made in the meeting and recorded. It is not deferred to "let us see how next week goes"

> The reason this is pre-agreed is that scope decisions made under pressure in week 6 are made badly and create resentment. Deciding the cut list in advance, while nobody is behind, makes it a plan rather than a failure.

# 6. Escalation

| Situation | Raise to | Within |
| --- | --- | --- |
| Blocked on a technical problem | The module owner, then the group | Half a day |
| Blocked on another member’s work | That member directly, then Darren | One day |
| A requirement is ambiguous or contradictory | Darren, who consolidates and asks Felix | One day |
| A story is clearly larger than estimated | Raised at the next backlog check with a revised estimate | Immediately, not at the end |
| Something is broken in production during the pilot | The support rota person, then the whole group | Immediately |
| Interpersonal or workload problem | Darren, or the supervisor if that is not appropriate | As soon as it is affecting work |

# 7. What We Are Optimising For

A pilot with two or three real operators taking real bookings at the end of week 8. Not the largest possible feature list. If a choice arises between another feature and the pilot working reliably, the pilot wins, and we write down what we cut and why.

Three things are non-negotiable regardless of schedule pressure: no overselling, no unreconciled money, and no personal data exposed. Everything else can be cut, flagged off, or deferred. These three cannot, because each one destroys trust in a way that shipping late does not.


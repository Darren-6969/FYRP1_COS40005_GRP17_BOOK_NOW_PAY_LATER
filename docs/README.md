# Project documents

## Which file is master for what

Four copies of the same information is three chances to be wrong. Decide the
master before you edit anything.

| What changes | Master copy | Then do this | How often |
| --- | --- | --- | --- |
| Task status, schedule, owner | `C_Development_Backlog.xlsx` | re-export `docs/backlog.csv` | weekly |
| Requirements, scope, a new feature | SRS DOCX, currently **V2.4** | regenerate `docs/srs/*.md`, bump the revision note | 2-3 times all project |

> **TODO (Darren):** confirm the shared drive location with the group and put
> the links to `C_Development_Backlog.xlsx` and the V2.4 SRS DOCX here. Until
> that lands, ask before assuming which copy you have is current — V1.5 is
> superseded and must not be used.
| Conventions, commands, gotchas | `CLAUDE.md` directly | nothing else | whenever you correct Claude twice |
| Module constraints | `.claude/rules/*.md` directly | nothing else | as you learn them |

`docs/srs/` is generated from the SRS. Do not hand-edit those files; the next
regeneration will overwrite you. Change the DOCX and re-export.

## Layout

```
CLAUDE.md              loaded every session
.claude/rules/         loaded by path when Claude opens a matching file
docs/srs/INDEX.md      requirement ID -> file lookup, start here
docs/srs/*.md          the specification, split by section
docs/backlog.csv       88 stories with acceptance criteria
docs/epics.md          the 16 epics
docs/work-plans.md     per-member briefing and the detailed Gantt
docs/metrics-framework.md  how we measure whether the pilot worked
docs/team-charter.md   how we work
docs/assets/           diagrams referenced by the SRS sections
```

## Keeping it honest

Put the sync date at the top of the file when you re-export. When someone sees
a stale date they know to check.

If `CLAUDE.md`, the rules and the SRS ever disagree, the SRS is correct about
*what to build* and `CLAUDE.md` is correct about *how to work here*. They serve
different purposes and most SRS changes should not touch `CLAUDE.md` at all.

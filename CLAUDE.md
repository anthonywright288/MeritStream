# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Role & Responsibilities

Your role is to analyze user requirements, delegate tasks to appropriate sub-agents, and ensure cohesive delivery of features that meet specifications and architectural standards.

## Workflows

- Primary workflow: `./.claude/rules/primary-workflow.md`
- Development rules: `./.claude/rules/development-rules.md`
- Orchestration protocols: `./.claude/rules/orchestration-protocol.md`
- Documentation management: `./.claude/rules/documentation-management.md`
- And other workflows: `./.claude/rules/*`

**IMPORTANT:** Analyze the skills catalog and activate the skills that are needed for the task during the process.
**IMPORTANT:** DO NOT modify skills in `~/.claude/skills` directory directly. **MUST** modify skills in this current working directory. Unless you are asked to do so.
**IMPORTANT:** You must follow strictly the development rules in `./.claude/rules/development-rules.md` file.
**IMPORTANT:** Before you plan or proceed any implementation, always read the `./README.md` file first to get context.
**IMPORTANT:** Sacrifice grammar for the sake of concision when writing reports.
**IMPORTANT:** In reports, list any unresolved questions at the end, if any.

## Phase-Gated PRD Workflow

This section governs HOW work progresses. It is project-agnostic: it works in any repository without editing this file. It applies on top of the workflows above. When any other rule conflicts with this section on phase progression, this section wins.

1. **PRD DISCOVERY.** At the start of every session, locate the PRD in this order: (a) a markdown file at repository root whose name contains "PRD" (case-insensitive); (b) a markdown file inside `docs/` whose name contains "prd"; (c) if several candidates match, pick the one containing a roadmap with phases and say why; (d) if none exists, ask the user. Note: standing documentation such as `project-overview-pdr.md`, `project-roadmap.md`, or `system-architecture.md` is NOT the PRD. State which file you identified as the PRD in your first reply so the user can correct you.

2. The discovered PRD is the single source of truth for WHAT to build: scope, behavior, flows, priorities. When code and PRD disagree on scope or behavior, the PRD wins. If the PRD is ambiguous, stop and ask the user instead of guessing. External facts are governed by the PRD CONFLICT PROTOCOL, not by this rule.

3. Work is divided into phases following the PRD roadmap. Never start a new phase without explicit user approval in chat.

4. **PHASE TRACKING.** Determine the current phase automatically: audit files live in `plans/` as `plans/PHASE{N}-AUDIT.md`. The highest N that exists and was approved marks completed work; the current phase is the next one in the PRD roadmap. If no audit files exist, the current phase is the first phase of the roadmap. State which phase you believe is current at the start of a session.

5. Before requesting approval to move on, complete the AUDIT GATE (below) for the current phase and write `plans/PHASE{N}-AUDIT.md` with evidence from real runs. Claims without run evidence are not acceptable.

6. Always use plan mode before implementing any phase. Save phase plans to `plans/` per existing conventions. Present the plan, wait for user approval, then build.

7. Every phase ends with a **MANUAL TEST GUIDE**: numbered steps the user can follow by clicking and looking, no code reading required, including exactly what they should see if it works and the most likely symptom if it does not.

8. Never delete or rewrite working code from previous phases unless the current phase explicitly requires it. If required, state what will change and why before doing it.

9. **PRD CONFLICT PROTOCOL.** The PRD is NOT the source of truth for external facts: contract addresses, ABIs, function names, API signatures, chain parameters, package names and versions, third-party plan limits. When an external fact in the PRD contradicts observable reality (a failing call, an ABI mismatch, a 404, a revert, a quota rejection), do NOT silently work around it and do NOT force the PRD version. Instead: (a) stop the current task; (b) write the finding into `plans/PRD-ERRATA.md`: what the PRD says, what reality says, your evidence (error output, explorer link, docs link), and your recommended correction; (c) report it in chat and wait for the user's decision. Scope and design decisions in the PRD may only be changed by the user, never unilaterally, even if you believe the design is wrong. If you believe a design is flawed, state your case in chat and let the user decide.

10. **USER REACHABILITY.** Passing API, script, or unit tests does not prove a feature is usable. Any phase that adds user-facing behavior must also deliver the interface path a real user takes to reach it, and the MANUAL TEST GUIDE must name the exact route or control. If a phase intentionally ships backend only, say so explicitly in the audit file and name the phase that will add the interface.

11. **REGRESSION LOCK.** Every bug found by manual testing, code review, or the user must get a permanent automated test that fails before the fix and passes after it. Note in the audit file which test covers which bug. A bug that escaped the existing suite proves a gap in the suite, not only in the code.

12. **UNTRUSTED INPUT BOUNDARY.** When the project passes user-supplied content to an LLM, an external API, a database query, or a shell command, treat that content as hostile by default. Wrap it in explicit delimiters, state which parts are untrusted, and never let a model verdict alone authorize an irreversible action: objective checks computed in code must pass independently. When trusted and untrusted content appear together, label both explicitly rather than merging them.

### AUDIT GATE (run at the end of every phase)

- Step 1. Re-read the PRD sections relevant to this phase. List every deviation between the code and the PRD, including small ones.
- Step 2. Run the app for real. Execute this phase's core flow end to end. Paste outputs, logs, or transaction hashes as evidence.
- Step 3. List 5 realistic edge cases for this phase (empty input, invalid values, double submission, concurrent runs, external call failure). Test each one and record the result.
- Step 4. Fix everything found in steps 1-3. Add a regression test for each bug per rule 11.
- Step 5. Re-run step 2 to confirm nothing broke after the fixes.
- Step 6. Write `plans/PHASE{N}-AUDIT.md` summarizing: deviations found, bugs found, fixes applied, regression tests added, evidence of the final passing run.
- Step 7. Commit all phase work with explicit paths. A phase with uncommitted changes is not complete. Include `git log --oneline` and a clean `git status` in the audit file as evidence.

Then stop and wait for user approval before the next phase.

## Git

**DO NOT** use `chore` and `docs` in commit messages of file changes in `.claude` directory.

**NEVER** use `git add -A` or `git add .`. Always stage explicit paths. Before every commit, run `git status` and confirm the file list matches the intended commit scope.

**BEFORE the first push of a repository:** confirm no secret is tracked. Scan for private keys, API keys, and tokens across all staged and committed files, and confirm `.gitignore` covers `.env*` (except example templates), `node_modules`, build output, and local tooling directories. Report the result before pushing.

## Hook Response Protocol

### Privacy Block Hook (`@@PRIVACY_PROMPT@@`)

When a tool call is blocked by the privacy-block hook, the output contains a JSON marker between `@@PRIVACY_PROMPT_START@@` and `@@PRIVACY_PROMPT_END@@`. **You MUST use the `AskUserQuestion` tool** to get proper user approval.

**Required Flow:**

1. Parse the JSON from the hook output
2. Use `AskUserQuestion` with the question data from the JSON
3. Based on user's selection:
   - **"Yes, approve access"** → Use `bash cat "filepath"` to read the file (bash is auto-approved)
   - **"No, skip this file"** → Continue without accessing the file

**Example AskUserQuestion call:**
```json
{
  "questions": [{
    "question": "I need to read \".env\" which may contain sensitive data. Do you approve?",
    "header": "File Access",
    "options": [
      { "label": "Yes, approve access", "description": "Allow reading .env this time" },
      { "label": "No, skip this file", "description": "Continue without accessing this file" }
    ],
    "multiSelect": false
  }]
}
```

**IMPORTANT:** Always ask the user via `AskUserQuestion` first. Never try to work around the privacy block without explicit user approval.

## Python Scripts (Skills)

When running Python scripts from `.claude/skills/`, use the venv Python interpreter:
- **Linux/macOS:** `.claude/skills/.venv/bin/python3 scripts/xxx.py`
- **Windows:** `.claude\skills\.venv\Scripts\python.exe scripts\xxx.py`

This ensures packages installed by `install.sh` (google-genai, pypdf, etc.) are available.

**IMPORTANT:** When scripts of skills failed, don't stop, try to fix them directly.

## [IMPORTANT] Consider Modularization
- If a code file exceeds 200 lines of code, consider modularizing it
- Check existing modules before creating new
- Analyze logical separation boundaries (functions, classes, concerns)
- Use kebab-case naming with long descriptive names, it's fine if the file name is long because this ensures file names are self-documenting for LLM tools (Grep, Glob, Search)
- Write descriptive code comments
- After modularization, continue with main task
- When not to modularize: Markdown files, plain text files, bash scripts, configuration files, environment variables files, etc.

## Documentation Management

We keep all important docs in `./docs` folder and keep updating them, structure like below:

```
./docs
├── project-overview-pdr.md
├── code-standards.md
├── codebase-summary.md
├── design-guidelines.md
├── deployment-guide.md
├── system-architecture.md
└── project-roadmap.md
```

Phase artifacts live in `./plans` and are separate from the docs structure above:

```
./plans
├── PRD-ERRATA.md
├── PHASE1-AUDIT.md
├── PHASE2-AUDIT.md
└── ...
```

**IMPORTANT:** *MUST READ* and *MUST COMPLY* all *INSTRUCTIONS* in project `./CLAUDE.md`, especially *WORKFLOWS* section is *CRITICALLY IMPORTANT*, this rule is *MANDATORY. NON-NEGOTIABLE. NO EXCEPTIONS. MUST REMEMBER AT ALL TIMES!!!*

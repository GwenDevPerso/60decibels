Take-Home Exercise
Design a Resilient Large-File Upload & Data Preview Experience

Role focus: Frontend-leaning full-stack engineer
Product type: Data-heavy user interfaces
Timebox: ~3 hours
AI tools: Allowed and expected

Context

Users upload large CSV files (10–100MB) into a data analysis tool.

Because the application runs on serverless infrastructure, request size limits apply. To work around this, the app uses a client-side chunked upload approach.

A basic implementation already exists, but the user experience and state handling are fragile. This exercise focuses on designing a trustworthy, resilient frontend workflow around chunked uploads and providing a clear data preview for non-technical users.

This is not an infrastructure exercise. We’re interested in frontend systems thinking, UX under constraints, and good judgment.

What’s provided

The starter project includes:

A Next.js App Router application

Local API routes for uploads (no database, no auth)

A basic chunked upload implementation

An upload UI

A simple data preview UI

Local storage of uploaded chunks and assembled files

Everything runs locally with no external services.

Your task
1. Improve the upload experience (UX)

Design a clear, user-trustworthy upload workflow.
Think in explicit phases, for example:

Select → Validate → Upload (chunked) → Finalize → Ready


Your solution should:

Communicate progress users can trust

Clearly explain what’s happening at each stage

Handle errors with actionable messaging

Support retry in a sensible way

Avoid showing “success” before the upload is truly complete

Assume users are non-technical.

2. Improve client-side robustness

The existing chunking logic is intentionally simple.

Improve it to better handle:

Chunk orchestration and ordering

State transitions (avoid “boolean soup”)

Partial failure (e.g., a chunk fails mid-upload)

Cancellation or restart behavior

Safe retry assumptions from a frontend perspective

A perfect solution is not required. Focus on clarity, correctness, and reasonable tradeoffs.

3. Improve the data preview surface

After upload, users should be able to sanity-check their data.

Improve or extend the preview UI so that it:

Handles wide datasets (20–100 columns)

Is readable for non-technical users

Surfaces schema or data issues early

Prioritizes clarity over completeness

⚠️ No design mocks are provided intentionally.
We want to see your judgment and UX instincts.

A minimal solution is completely acceptable (e.g., first N rows, column list, inferred types).

4. Document your decisions

Add a short DECISIONS.md (or a section in the README) covering:

What you changed and why

What you intentionally did not do

Tradeoffs you made

What you would ask the backend for next (if anything)

Treat this like a real production PR.

Constraints

Timebox: ~3 hours (please don’t overbuild)

AI assistants: allowed and expected

Backend: assume provided API routes work as documented

Infrastructure: do not redesign storage or introduce cloud services

Testing: optional

We care far more about judgment and clarity than polish.

Optional extensions (choose at most one)

Only if time permits:

Resumable uploads

Chunk-level retry with backoff

Cancel or pause uploads

Improved progress accuracy (bytes vs chunks)

Schema validation or column mapping UX

Accessibility improvements

Performance improvements (e.g., table rendering)

Choosing what not to do is part of the exercise.

What we’re evaluating
Judgment & product sense (highest priority)

Did you focus on the right problems?

Is the UX calm, clear, and trustworthy?

Are tradeoffs explicit and reasonable?

Frontend architecture

Clear state model

Predictable side effects

Sensible component boundaries

Data-heavy UI instincts

Preview is usable for wide data

Schema issues are surfaced early

Information density is handled thoughtfully

Full-stack awareness

Reasonable assumptions about backend behavior

Clear separation of frontend vs backend responsibility

Pragmatic backend “asks” (not hacks)

Communication

Clear explanations

Honest limitations

Evidence of restraint

Important note on AI

You may use AI tools.
We are not evaluating raw code output — we’re evaluating decisions, clarity, and judgment.

Strong submissions explain why something exists, not just how.

Submission

Please share:

A link to your repo (or a zip)

Brief instructions to run it

Your DECISIONS.md

We’ll follow up with a short review call to walk through one decision and discuss what you’d do next.

Final note

This exercise mirrors real-world work on data-heavy products under constraints.

Keep it pragmatic, focused, and honest.

We’re excited to see how you think.
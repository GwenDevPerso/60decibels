## Setup

## Prerequisites

Node.js 18+ (Node 20 recommended)
npm (included with Node)

node -v
npm install
npm run dev

## Generate a large sample CSV (optional)
npm run gen:csv


### `TAKEHOME.md` (the actual prompt you send)
Use the “bring it all together” prompt we wrote, with repo-specific notes:

- chunking baseline exists in `hooks/useChunkedUpload.ts`
- local API routes in `app/api/upload/*`

(If you want, I’ll paste a polished `TAKEHOME.md` version tailored to this exact repo layout.)

---

## What to seed as “known issues” 
This starter already includes a couple:
- progress is based on **chunk count**, not bytes
- sequential uploads only
- no resumability
- minimal error UX




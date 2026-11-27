# Private health archive

Russian and English health records, searchable documents, measurement history,
editable checkup frequencies, and reviewed extraction from screenshots or text.
Includes a vaccination calendar, planned versus completed doses, and replacement
history for toothbrushes and loofahs with editable, attributed guidance.

This repository contains application code and synthetic test fixtures only.
Medical records, source exports, images, PDFs, and passwords must never be committed.

## Storage and sign-in

The Cloudflare Worker requires a secure session before serving the interface,
records, or documents. Records and originals are stored in the private R2 bucket.
Durable Objects coordinate sessions, concurrent saves, and operation limits.
The initial R2 seed is read only when no saved archive exists; a deployment never
replaces saved records or resets the current password.

Screenshot recognition runs in the browser. Extracted values, visits, and
prescriptions are reviewed before saving. Originals are uploaded to private R2.

## Development

Use Node.js 22 or newer:

```sh
npm install
npm run build
npm test
```

An empty checkout contains no medical data. The full archive is available only
after signing in to the published website.

## Automatic deployment

Cloudflare Workers Builds watches the production branch `main`:

- Root directory: `/`
- Build command: `npm run build && npm test`
- Deploy command: `npm run deploy:ci`

Use the existing Cloudflare build token and Worker password secret.
The deploy command checks that the one-time private R2 import is complete before
publishing. If it is missing, the build stops and the existing website keeps running.
The private import tool and its source files are intentionally absent from GitHub.
After the import, code updates on `main` publish without the local computer.

Do not enable public R2 access. Do not upload medical exports to GitHub to fix a build.

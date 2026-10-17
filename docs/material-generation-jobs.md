# Manual cause-material generation

The setup wizard's Generate button now creates a persisted job and returns HTTP 202 immediately. It no longer holds the browser request open while all twelve PDFs render.

Each PDF is rendered, uploaded and saved separately. Only then does the job increment `flyerCount`. The page polls every two seconds, displays `0/12` through `12/12` with a progress bar, and lists the finished PDFs for immediate opening. The current batch's version filters the list so old flyers do not masquerade as new progress.

Jobs and the short/feature video references survive browser refresh and server restart. The background worker starts with the Next server via instrumentation and resumes unfinished batches; the existing flyer-version checks skip already saved files. A failed batch remains visibly partial and can be retried. After 30 minutes without completion it becomes actionable rather than leaving the button spinning forever.

Completed materials are collected into the landing draft. Publishing remains a separate review action.

## QA configuration

Set these only on the isolated QA dashboard:

```text
CAUSE_MATERIAL_JOBS_ENABLED=1
CAUSE_MATERIAL_JOB_DIR=/var/lib/localvip-material-jobs-qa
CAUSE_VIDEO_DURABLE_JOBS=1
CAUSE_VIDEO_RENDER_URL=http://127.0.0.1:4320
CAUSE_VIDEO_RENDER_TOKEN=<separate QA renderer token>
```

Keep the existing QA-only public dashboard/app/backend URLs and `QA_AUTH_STATE_SECRET`. The job directory must persist across releases. Job files are encrypted using that secret and have mode 0600. They contain a delegated access token while work is active; it is removed on completion/failure. An expired delegated session produces a visible retry error, and signing in again allows a new request to resume saved flyers. Run one Next server worker per job directory; the PID lock prevents duplicate runners on the same host.

The separate QA renderer uses its own code directory, port, token, jobs and outputs. Generated media are streamed through `/api/cause-video/generated/<file>`; the worker token never reaches the browser. The live renderer and live frontend processes are not used for QA generation.

## Completion notification

Manual batches create one persistent dashboard Action Center notification for the explicit cause contact, rather than emailing on every regeneration. The QA backend's `/api/dashboard/v1/Notification/materials-ready` endpoint verifies all twelve distinct current flyer variants and both current videos/posters before accepting completion. It finds the contact by the cause owner's email and linked account membership, with no administrator fallback. A missing linked contact is shown on the generation page.

The notification and an existing unique outbox dedupe key commit in one transaction. Retrying after a dropped response does not duplicate the notification. Partial/failed batches never create success notifications. Automatic background asset refreshes do not enter this manual job queue and do not notify.

## Checks

```text
npx tsx --test scripts/material-jobs.test.ts scripts/material-media.test.ts scripts/cause-video-durable.test.ts scripts/cause-launch-materials.test.ts
```

The backend has `MaterialsCompletionTests`, covering missing/duplicate/stale flyer variants, missing posters and stale video sources. No new database migration is required for notifications.

## QA activation, 2026-10-17

Activated at `https://dashboard-qa.5.252.52.243.sslip.io/community/setup?step=materials`. Only the QA frontend process was restarted. The new renderer is `localvip-cause-video-qa`, at `/opt/localvip-cause-video-qa`, with persistent output at `/var/lib/localvip-cause-videos-qa`. The dashboard worker lock was verified to belong to the running QA server, and the real QA smoke video's public URL returned HTTP 200 without a login redirect.

The backend notification patch was built in the isolated `localvip-materials-qa-backend` checkout from QA's deployed commit `704b56e`, adding only the notification partial controller and its test. It was deployed only into IIS site/app pool `qa-new.localvip.com` on `62.146.230.220`, after checking the QA marker, loopback binding 8083 and database `dbLocalVIP_QA`. Configuration and uploads were preserved. Backend discovery returned HTTP 200 afterwards.

QA frontend rollback snapshots remain at `.next.before-materials-20261017` and `.env.production.before-materials-20261017` under the QA dashboard directory; its source backup is `/tmp/localvip-materials-qa-source-before-20261017.tar.gz`. The QA backend's previous assembly is under `C:\inetpub\backups\qa-new.localvip.com\materials-20261017`. Live app, dashboard and renderer process IDs were unchanged across activation. No live deployment or database migration was performed.

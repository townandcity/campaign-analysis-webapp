# Deploying to Firebase (frontend) + Cloud Run (backend)

Firebase Hosting only serves static files — it can't run your Node/Socket.IO
backend. So: **frontend → Firebase Hosting**, **backend → Cloud Run** (same
Google account, same project, managed by Google, no separate signup).

Do these in order. Each step assumes the previous one succeeded.

---

## Step 0: Install the tools

You need two command-line tools, in a normal terminal:

```bash
npm install -g firebase-tools
```

And the Google Cloud CLI — download the installer for your OS from
https://cloud.google.com/sdk/docs/install and follow its prompts. Then verify both:

```bash
firebase --version
gcloud --version
```

If either prints an error, stop here — install it before continuing.

## Step 1: Create a Firebase project

1. Go to https://console.firebase.google.com → **Add project**.
2. Name it (e.g. `campaign-analysis`), finish the wizard (Google Analytics is optional, skip it).
3. Note the **Project ID** shown on the project's Settings page — you'll use it below. It may differ slightly from the name (e.g. `campaign-analysis-a1b2c`).

## Step 2: Log in and connect both CLIs to this project

```bash
firebase login
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com
```

(The `enable` command turns on the Cloud Run and Cloud Build APIs for this project — required once, may take a minute.)

## Step 3: Deploy the backend to Cloud Run

```bash
cd campaign-analysis-webapp/backend
gcloud run deploy campaign-analysis-backend \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080
```

This builds the Dockerfile and deploys it — takes 2-5 minutes the first time.
When it finishes, it prints a **Service URL** like:

```
https://campaign-analysis-backend-xxxxxxxx-uc.a.run.app
```

**Copy this URL — you need it in Step 4 and Step 5.**

By default it deploys in demo mode (safe — no Meta credentials needed yet, just proves hosting works). Test it:

```bash
curl https://campaign-analysis-backend-xxxxxxxx-uc.a.run.app/api/health
```

You should get back `{"ok":true,"mode":"demo",...}`.

## Step 4: Deploy the frontend to Firebase Hosting

```bash
cd ../frontend
```

Create a file called `.env.production` in the `frontend` folder with:
```
VITE_API_URL=https://campaign-analysis-backend-xxxxxxxx-uc.a.run.app
```
(use your actual Cloud Run URL from Step 3)

Then build and deploy:
```bash
npm install
npm run build
firebase init hosting
```
When `firebase init hosting` asks questions, answer:
- "Please select an option" → **Use an existing project** → pick the one from Step 1
- "What do you want to use as your public directory?" → `dist`
- "Configure as a single-page app?" → **Yes**
- "Set up automatic builds with GitHub?" → **No**
- "File dist/index.html already exists. Overwrite?" → **No**

Then:
```bash
firebase deploy --only hosting
```
It prints a **Hosting URL** like `https://your-project-id.web.app` — open that in your browser. You should see the dashboard ticking, now live on the internet.

## Step 5: Lock down CORS (important — skip this and the browser will block requests)

```bash
gcloud run services update campaign-analysis-backend \
  --region us-central1 \
  --set-env-vars CORS_ORIGIN=https://your-project-id.web.app
```
(use your actual Hosting URL from Step 4)

## Step 6: Switch the backend to real Meta data (optional, whenever ready)

```bash
gcloud run services update campaign-analysis-backend \
  --region us-central1 \
  --set-env-vars DEMO_MODE=false,META_ACCESS_TOKEN=YOUR_TOKEN,META_AD_ACCOUNT_IDS=123456789,POLL_INTERVAL_MS=300000,CORS_ORIGIN=https://your-project-id.web.app
```
(All env vars must be listed together in one `--set-env-vars` call — each call replaces the full set, it doesn't merge.)

Refresh your Hosting URL — it should now show real account data.

## Step 7 (optional): Meta leadgen webhook, now with a permanent URL

Since Cloud Run gives you a real public URL, you no longer need ngrok. In your Meta App Dashboard → Webhooks → Page → `leadgen`, set the callback URL to:
```
https://campaign-analysis-backend-xxxxxxxx-uc.a.run.app/webhooks/meta
```
and follow the same verify-token/app-secret steps as the local guide, setting `META_WEBHOOK_VERIFY_TOKEN` and `META_APP_SECRET` via the same `gcloud run services update --set-env-vars` command as Step 6.

---

## Making future changes

Whenever you edit backend code:
```bash
cd backend
gcloud run deploy campaign-analysis-backend --source . --region us-central1
```
Whenever you edit frontend code:
```bash
cd frontend
npm run build
firebase deploy --only hosting
```

## If something breaks

- **Frontend loads but says "Reconnecting…" forever** → CORS_ORIGIN on the backend doesn't match your Hosting URL exactly (check for trailing slash), or the backend crashed — check logs:
  ```bash
  gcloud run services logs read campaign-analysis-backend --region us-central1
  ```
- **`gcloud run deploy` fails during build** → run it again from inside the `backend` folder specifically (it uses the Dockerfile in the current directory).
- **403/permission errors** → make sure `gcloud config set project YOUR_PROJECT_ID` used the exact Project ID from Step 1, not the display name.

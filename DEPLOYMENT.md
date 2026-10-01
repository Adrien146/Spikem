# SPIKE production launch plan

## Chosen platform: Render

SPIKE is a Node.js web application with a server-side AI API, payment API routes, webhooks, scheduled billing, and persistent JSON data. A Render Web Service fits this architecture. The included `render.yaml` configures the build, start command, health check, environment variables, and a 1 GB persistent disk mounted at `/var/data`.

### 1. Choose hosting/platform
- Platform: Render Web Service.
- Runtime: Node.js.
- Production process: `npm start`.
- Health check: `/api/health`.
- Persistent application data: `/var/data`.
- Do not put API keys in the frontend or Git repository.

### 2. Deploy SPIKE
1. Put this project in a private Git repository you control, or connect the repository through a supported Render source.
2. Create a Render Web Service.
3. Use the settings from `render.yaml`.
4. Confirm the service binds to Render's `PORT` and `0.0.0.0`.
5. Wait for the build to finish.
6. Open `/api/health` and confirm it returns JSON with `ok: true`.

### 3. Configure owner/creator security
Set `SPIKE_OWNER_SECRET` to a long, random secret only Evans should know. The Creator Console checks this secret server-side through the `x-spike-owner-secret` header. Never place the secret in React source, `.env` committed to Git, or public documentation.

Creator identity is configured with:
- Creator: Evans Muyomba
- Creator ID: evans-muyomba
- Project: SPIKE Growth Intelligence
- Primary contact: adriensmith142@gmail.com

### 4. Production testing and verification
Before public launch, test:
- Landing page and mobile layout.
- Onboarding and local business context saving.
- Dashboard, Growth, Actions, Customers, Money, Research and Feedback.
- `/api/health`.
- `/api/integrations/status` without exposing secrets.
- Creator Console owner authentication.
- AI chat with a real server-side API key.
- Research with current public web information.
- Payment sandbox checkout and verified webhook handling.
- Restart/deploy persistence for feedback, usage and subscription JSON data.

### 5. Connect the AI functionality
Set `OPENAI_API_KEY` as a server-only secret. Keep `OPENAI_MODEL=gpt-5.6-luna` unless you intentionally choose another model available to your API project. SPIKE uses the Responses API and server-side web search for its research capability.

### 6. Payments/subscriptions and persistent data
Start with `PEACH_ENV=sandbox`. Add the Peach credentials only in the hosting provider's secret environment. Do not enable live billing until checkout, webhook verification, subscription state changes, renewal handling and cancellation behavior have been tested end-to-end.

The current MVP persists subscriptions, usage and feedback as JSON files. The included Render persistent disk keeps `/var/data` across deploys/restarts. This is appropriate for the single-instance MVP. Before scaling to multiple application instances, migrate these records to a managed database such as PostgreSQL.

### 7. Connect the domain
After the Render service is working, add the chosen custom domain in Render, update the DNS records at the domain provider, wait for TLS to provision, then set `SPIKE_PUBLIC_URL` to the final HTTPS URL.

### 8. Test the public version
Run the same smoke tests using the public HTTPS domain, including signup/onboarding, AI, feedback, Creator Console, checkout sandbox, webhooks and persistence.

### 9. Verify Creator Console
Use the private owner secret to sign in. Confirm feedback search, filtering, pinning, status changes and creator replies work. Do not share the owner secret with users.

### 10. Launch
Only switch payments from sandbox to live after the live merchant account and recurring-payment credentials are approved and tested. Then update `PEACH_ENV=live`, production Peach credentials, the final HTTPS public URL, and complete one final public smoke test.

## Important production boundary
This package is deployment-prepared, not proof that external accounts are already configured. Hosting, OpenAI API access, Peach merchant onboarding, DNS, and payment credentials must still be connected in the respective services.

# SPIKE + Peach Payments integration

SPIKE now contains a real server-side Peach Payments V2 Hosted Checkout integration skeleton.

## What is wired
- `POST /api/billing/checkout` creates a Peach V2 checkout on the server.
- The browser never receives Peach client secrets.
- Checkout is fixed server-side at US$10 (the frontend may request an allowed display currency).
- Initial checkout requests `createRegistration=true` and subscription standing-instruction metadata so a supported payment method can return a registration token for recurring billing.
- `POST /api/billing/webhook` verifies Peach HMAC webhook signatures before accepting events.
- `GET /api/health` reports whether required server configuration exists.
- The frontend's Growth checkout button redirects to Peach's hosted checkout instead of pretending an upgrade succeeded.

## Required Peach credentials
Set these only as server environment variables:
- `PEACH_CLIENT_ID`
- `PEACH_CLIENT_SECRET`
- `PEACH_MERCHANT_ID`
- `PEACH_ENTITY_ID`
- `PEACH_WEBHOOK_SECRET`

Never put these in `src/`, browser storage, screenshots, GitHub, or chat.

## Sandbox first
Use `PEACH_ENV=sandbox` while testing. Peach's current V2 documentation uses the sandbox Dashboard for OAuth credentials and the test Checkout endpoint. Move to live only after the merchant account is approved and the integration has been tested.

## Important production work still required
This package intentionally does **not** fake subscription activation. A production release still needs:
1. Real user authentication.
2. A persistent database for users, subscriptions, payment IDs and registration IDs.
3. Idempotent webhook processing and event ordering handling.
4. A secure recurring-charge worker/scheduler that uses Peach's recurring API with the stored registration ID.
5. Cancellation/refund handling and account entitlement rules.
6. HTTPS deployment and the exact deployed URL allowlisted in Peach.
7. Merchant/provider verification and settlement configuration.

The current frontend remains usable without credentials, but clicking checkout will show a server configuration error until the server environment is configured.

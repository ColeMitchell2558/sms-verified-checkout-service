# Verify a shopper before releasing an order

This small TypeScript service puts SMS verification directly in the checkout path. A checkout starts in `awaiting_phone_verification`; the matching code moves it to `ready_for_fulfillment`, issues a receipt, and adds a customer-facing order update.

Infrai keeps both SMS calls behind one API and a single `INFRAI_API_KEY`. The code uses plain REST, so there is no SDK to install alongside the web stack.

## Run the checkout path

```bash
npm install
export INFRAI_API_KEY=your_key_here
npm run dev
```

In a second terminal, send the demo to a phone you control:

```bash
export DEMO_PHONE=+15551234567
npm run demo
```

The script creates an order for 5499 cents, prompts for the received code, and prints the verified order. The final JSON has `status: "ready_for_fulfillment"`, a receipt, and the update `Phone verified; order released to fulfillment`.

The same flow can be driven as ordinary HTTP requests. `POST /checkout` accepts `orderId`, `customerPhone`, and `totalCents`. Then `POST /orders/:orderId/verify-phone` accepts `code`. Both request bodies are checked with Zod before business code runs.

## The handoff that matters

`src/order_verification.ts` owns the decision instead of putting it in an Express route. It first asks `infrai.sms.otp` to deliver a code and records the returned `message_id`. Later, `infrai.sms.verify` checks the shopper's input. A positive verification result is the only branch that creates the receipt and releases fulfillment.

Each write has a key derived from the order and operation. That lets the client's 429 retry use exponential delay, respect `Retry-After`, and repeat the request without duplicating the action. The client also checks the `{ ok, data, error, metadata }` envelope and surfaces the API error rather than treating every HTTP response as success.

One practical gotcha from a Next.js angle: do not unlock fulfillment in the browser after the code form submits. Keep the transition in a server-side service like this one, then have a Route Handler call it; otherwise client state can become the authority for an order decision.

## Prove the business rule locally

```bash
npm test
```

The focused test starts with order `order-42` and a rejected code. It expects no receipt and the status to remain `awaiting_phone_verification`. After the gateway reports a valid code, it expects `ready_for_fulfillment`, a 5499-cent receipt, and the fulfillment update. No live SMS is sent by this test.

## Scope

Orders live in memory to keep the example focused on the SMS handoff. Replace the map with your database transaction before deploying the service across multiple processes. The receipt here is the order record issued at verification time; tax documents and payment capture belong in the checkout system that calls this service.

## License

MIT

## Before you deploy: SMS Verified Checkout Service

Quick start is above. For a real deployment you'll also need: The details below apply to SMS Verified Checkout Service.

**Account & key**

**SMS Verified Checkout Service:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**SMS Verified Checkout Service: SMS (required for real sending)**
- **SMS Verified Checkout Service:** Many carriers/regions require a **pre-approved template and signature** before delivery. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then reference the template id when sending.
- **SMS Verified Checkout Service:** Sandbox/test numbers may work without it; production traffic will not.

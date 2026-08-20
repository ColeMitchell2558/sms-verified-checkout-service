import assert from "node:assert/strict";
import test from "node:test";
import type { SmsOtpGateway } from "../src/infrai_sms.js";
import { OrderVerificationService } from "../src/order_verification.js";

test("fulfillment and receipt wait for a successful phone verification", async () => {
  let verified = false;
  const sms: SmsOtpGateway = {
    async sendOtp() {
      return { message_id: "msg-test-1" };
    },
    async verifyOtp() {
      return { verified };
    }
  };
  const service = new OrderVerificationService(sms);
  await service.beginCheckout({
    orderId: "order-42",
    customerPhone: "+15551234567",
    totalCents: 5499
  });

  const rejected = await service.confirmPhone({ orderId: "order-42", code: "111111" });
  assert.equal(rejected.status, "awaiting_phone_verification");
  assert.equal(rejected.receipt, undefined);

  verified = true;
  const accepted = await service.confirmPhone({ orderId: "order-42", code: "246810" });
  assert.equal(accepted.status, "ready_for_fulfillment");
  assert.equal(accepted.receipt?.totalCents, 5499);
  assert.deepEqual(accepted.customerUpdates, [
    "Verification code sent",
    "Phone verified; order released to fulfillment"
  ]);
});

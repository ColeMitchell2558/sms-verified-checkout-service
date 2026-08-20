import type { SmsOtpGateway } from "./infrai_sms.js";

export type OrderStatus = "awaiting_phone_verification" | "ready_for_fulfillment";

export type CheckoutOrder = {
  orderId: string;
  customerPhone: string;
  totalCents: number;
  status: OrderStatus;
  otpMessageId?: string;
  receipt?: { orderId: string; totalCents: number; issuedAt: string };
  customerUpdates: string[];
};

export class OrderVerificationService {
  private readonly orders = new Map<string, CheckoutOrder>();
  private readonly sms: SmsOtpGateway;

  constructor(sms: SmsOtpGateway) {
    this.sms = sms;
  }

  async beginCheckout(input: {
    orderId: string;
    customerPhone: string;
    totalCents: number;
  }): Promise<CheckoutOrder> {
    const existing = this.orders.get(input.orderId);
    if (existing) return existing;

    const sent = await this.sms.sendOtp({
      to: input.customerPhone,
      idempotencyKey: `checkout:${input.orderId}:otp`
    });
    const order: CheckoutOrder = {
      ...input,
      status: "awaiting_phone_verification",
      otpMessageId: sent.message_id,
      customerUpdates: ["Verification code sent"]
    };
    this.orders.set(input.orderId, order);
    return order;
  }

  async confirmPhone(input: { orderId: string; code: string }): Promise<CheckoutOrder> {
    const order = this.orders.get(input.orderId);
    if (!order) throw new Error("Order not found");
    if (order.status === "ready_for_fulfillment") return order;

    const result = await this.sms.verifyOtp({
      to: order.customerPhone,
      code: input.code,
      idempotencyKey: `checkout:${order.orderId}:verify:${input.code}`
    });
    if (!result.verified) return order;

    order.status = "ready_for_fulfillment";
    order.receipt = {
      orderId: order.orderId,
      totalCents: order.totalCents,
      issuedAt: new Date().toISOString()
    };
    order.customerUpdates.push("Phone verified; order released to fulfillment");
    return order;
  }

  getOrder(orderId: string): CheckoutOrder | undefined {
    return this.orders.get(orderId);
  }
}

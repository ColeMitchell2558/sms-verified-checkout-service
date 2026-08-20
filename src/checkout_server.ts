import express from "express";
import { z } from "zod";
import { infraiSmsGateway } from "./infrai_sms.js";
import { OrderVerificationService } from "./order_verification.js";

const checkoutBody = z.object({
  orderId: z.string().min(1),
  customerPhone: z.string().regex(/^\+[1-9]\d{7,14}$/),
  totalCents: z.number().int().positive()
});

const verificationBody = z.object({
  code: z.string().regex(/^\d{4,8}$/)
});

export const app = express();
const orders = new OrderVerificationService(infraiSmsGateway);
app.use(express.json());

app.post("/checkout", async (request, response, next) => {
  try {
    const body = checkoutBody.parse(request.body);
    response.status(201).json(await orders.beginCheckout({
      orderId: body.orderId,
      customerPhone: body.customerPhone,
      totalCents: body.totalCents
    }));
  } catch (error) {
    next(error);
  }
});

app.post("/orders/:orderId/verify-phone", async (request, response, next) => {
  try {
    const { code } = verificationBody.parse(request.body);
    response.json(await orders.confirmPhone({ orderId: request.params.orderId, code }));
  } catch (error) {
    next(error);
  }
});

app.get("/orders/:orderId", (request, response) => {
  const order = orders.getOrder(request.params.orderId);
  if (!order) return response.status(404).json({ message: "Order not found" });
  return response.json(order);
});

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  if (error instanceof z.ZodError) return response.status(400).json({ issues: error.issues });
  const message = error instanceof Error ? error.message : "Unexpected error";
  return response.status(message === "Order not found" ? 404 : 500).json({ message });
});

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 3000);
  app.listen(port, () => console.log(`Checkout service listening on http://localhost:${port}`));
}

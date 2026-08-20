export {};

const baseUrl = process.env.DEMO_BASE_URL ?? "http://localhost:3000";
const phone = process.env.DEMO_PHONE;
if (!phone) throw new Error("DEMO_PHONE is required");

const orderId = `demo-${Date.now()}`;
const checkout = await fetch(`${baseUrl}/checkout`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ orderId, customerPhone: phone, totalCents: 5499 })
});
if (!checkout.ok) throw new Error(await checkout.text());
console.log("Checkout:", await checkout.json());

process.stdout.write("Enter the SMS code: ");
for await (const chunk of process.stdin) {
  const code = chunk.toString().trim();
  const verified = await fetch(`${baseUrl}/orders/${orderId}/verify-phone`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code })
  });
  if (!verified.ok) throw new Error(await verified.text());
  console.log("Verified order:", await verified.json());
  break;
}

const amqp = require("amqplib");

const URL = process.env.RABBITMQ_URL || "amqp://orbit:orbit@broker:5672";
const EXCHANGE = "orbit.events";
const QUEUE = "notifications.order";

async function start() {
  for (let i = 0; i < 30; i++) {
    try {
      const conn = await amqp.connect(URL);
      const channel = await conn.createChannel();
      await channel.assertExchange(EXCHANGE, "topic", { durable: true });
      const q = await channel.assertQueue(QUEUE, { durable: true });
      await channel.bindQueue(q.queue, EXCHANGE, "order.*");
      console.log("notifications waiting for events");
      channel.consume(q.queue, (msg) => {
        if (!msg) return;
        const event = JSON.parse(msg.content.toString());
        console.log(
          `notification: order #${event.orderId} for ${event.email || "customer"} total ${event.total} — sending confirmation email`
        );
        channel.ack(msg);
      });
      return;
    } catch (err) {
      console.log("notifications waiting for broker:", err.message);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  process.exit(1);
}

start();

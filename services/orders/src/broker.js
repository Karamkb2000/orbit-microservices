const amqp = require("amqplib");

const URL = process.env.RABBITMQ_URL || "amqp://orbit:orbit@broker:5672";
const EXCHANGE = "orbit.events";

let channel = null;

async function connect() {
  for (let i = 0; i < 30; i++) {
    try {
      const conn = await amqp.connect(URL);
      channel = await conn.createChannel();
      await channel.assertExchange(EXCHANGE, "topic", { durable: true });
      console.log("orders connected to broker");
      return;
    } catch (err) {
      console.log("orders waiting for broker:", err.message);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw new Error("broker not reachable");
}

function publish(routingKey, payload) {
  if (!channel) return;
  channel.publish(EXCHANGE, routingKey, Buffer.from(JSON.stringify(payload)), {
    contentType: "application/json",
  });
}

module.exports = { connect, publish };

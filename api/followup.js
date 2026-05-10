import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
export default async function handler(req, res) {
  const { data: clients } = await supabase
    .from("clients")
    .select("*")
    .eq("status", "interesado");

  console.log("CLIENTES INTERESADOS:", clients);
  for (const client of clients || []) {
 const completion = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    {
      role: "system",
      content: `
Eres un vendedor amable especializado en WhatsApp.

Genera mensajes cortos de seguimiento
para usuarios interesados en comprar un curso digital.

Debe sonar humano, natural y cercano.
`,
    },
    {
      role: "user",
      content: `
Cliente interesado.
Último nodo: ${client.last_node}
Estado: ${client.status}
`,
    },
  ],
});

const followupMessage =
  completion.choices[0].message.content;
    await fetch(
    `https://graph.facebook.com/v19.0/${process.env.PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: client.phone,
        type: "text",
        text: {
          body: followupMessage,
        },
      }),
    }
  );

  console.log("FOLLOWUP ENVIADO:", client.phone);
}

  return res.status(200).json({
    ok: true,
    clients,
  });
}

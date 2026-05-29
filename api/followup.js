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
 .eq("status", "interesado")
  .is("last_followup_sent", null)
  .is("checkout_at", null);

  console.log("CLIENTES INTERESADOS:", clients);
  for (const client of clients || []) {
    
    const { data: product } = await supabase
  .from("products")
  .select("*")
  .eq("id", client.current_product)
  .single();
    
 const completion = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    {
      role: "system",
      content: `
Eres un experto en ventas por WhatsApp.

Genera mensajes de seguimiento
emocionales, naturales y persuasivos.

Nunca uses frases genéricas como:
- "hola buenas tardes"
- "en que puedo ayudarte"
- "estoy aquí para ayudarte"

Los mensajes deben:
- despertar curiosidad
- tocar dolores emocionales
- sentirse humanos
- generar respuesta
- sonar como una conversación real

Habla siempre según el producto que el cliente está viendo actualmente.
`,
    },
    {
      role: "user",
      content: `
Cliente interesado.

El cliente dejó de responder después de esta etapa:
${client.last_node}

Estado:
${client.status}

PRODUCTO:
${product?.name}

DESCRIPCIÓN:
${product?.description}

PROMESA:
${product?.promise}

El cliente aún no compra.

NO repitas literalmente el último mensaje
ni vuelvas a enviar el mismo nodo.

Continúa la conversación de forma natural,
emocional y humana.

El objetivo es:
- reactivar el interés
- generar respuesta
- resolver dudas
- continuar la conversación naturalmente

Haz un mensaje corto, humano y conversacional
como un vendedor real de WhatsApp.
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
    await supabase
  .from("clients")
  .update({
    last_followup_sent: new Date(),
  })
  .eq("phone", client.phone);
}

  return res.status(200).json({
    ok: true,
    clients,
  });
}

import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
export async function GET(req) {
  const { searchParams } = new URL(req.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

if (mode === "subscribe" && token === process.env.VERIFY_TOKEN){
    return new Response(challenge, { status: 200 });
  }

  return new Response("Error", { status: 403 });
}

export async function POST(req) {
  const body = await req.json();

  console.log("Mensaje recibido:", JSON.stringify(body, null, 2));

  try {
    const message =
      body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (message) {
      const from = message.from;
      const contactName =
  body.entry?.[0]?.changes?.[0]?.value?.contacts?.[0]?.profile?.name || "";
  const userText =
  message?.text?.body?.toLowerCase() || "";

const { data: existingClient } = await supabase
  .from("clients")
  .select("*")
  .eq("phone", from)
  .single();

let selectedNode =
  message?.interactive?.button_reply?.id ||
  existingClient?.last_node;

      const clientResult = await supabase
  .from("clients")
  .upsert(
    {
      phone: from,
      name: contactName,
      last_node: selectedNode,
      last_interaction: new Date(),
    },
    {
      onConflict: "phone",
    }
  );

console.log("CLIENT RESULT:", clientResult);
      if (selectedNode === "precio_velas") {
  await supabase
    .from("clients")
    .update({
      status: "interesado",
    })
    .eq("phone", from);
}
if (
  userText.includes("ya pague") ||
  userText.includes("ya pagué") ||
  userText.includes("compre") ||
  userText.includes("compré")
) {
  await supabase
    .from("clients")
    .update({
      status: "cliente",
      checkout_at: new Date(),
    })
    .eq("phone", from);
}    
const { data: node, error } = await supabase
  .from("nodes")
  .select("*")
  .eq("node_key", selectedNode)
  .single();
     const { data: product } = await supabase
  .from("products")
  .select("*")
  .eq("is_active", true)
  .single();

console.log("PRODUCT:", product);
      if (!selectedNode) {
  selectedNode = product?.start_node;
}
console.log("NODO:", node);
      console.log("NODE MESSAGE:", node?.message);
console.log("USE AI:", node?.use_ai);
console.log("SELECTED NODE:", selectedNode);
      console.log("ERROR SUPABASE:", error);
      const completion = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    {
      role: "system",
      content: `
Eres un vendedor amable especializado en cursos digitales.

NODO ACTUAL:
${selectedNode}

MENSAJE DEL NODO:
${node?.message}

PRODUCTO:
${product?.name}

DESCRIPCIÓN:
${product?.description}

PROMESA:
${product?.promise}

PRECIO:
${product?.price} ${product?.currency}

Tu objetivo es responder de forma natural,
persuasiva y ayudar a cerrar la venta.
`,
    },
    {
      role: "user",
      content:
        message?.text?.body ||
        selectedNode,
    },
  ],
});
      
const aiMessage = node?.use_ai
  ? completion.choices[0].message.content
  : node?.message;
      const { data: clientData } = await supabase
  .from("clients")
  .select("*")
  .eq("phone", from)
  .single();
const buttons =
  clientData?.status === "cliente"
    ? []
    : (node?.buttons || []).slice(0, 3).map((btn) => ({
        type: "reply",
        reply: {
          id: btn.destino,
          title: btn.texto
            .replace(/[^\w\s]/gi, "")
            .substring(0, 20),
        },
      }));
      console.log("BUTTONS LIMPIOS:", buttons);
     const response = await fetch(
  `https://graph.facebook.com/v19.0/${process.env.PHONE_NUMBER_ID}/messages`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
   body: JSON.stringify(
  buttons.length > 0
    ? {
        messaging_product: "whatsapp",
        to: from,
        type: "interactive",

        interactive: {
          type: "button",

          body: {
            text: aiMessage || node?.message || "Hola 👋",
          },

          action: {
            buttons,
          },
        },
      }
    : {
        messaging_product: "whatsapp",
        to: from,
        type: "text",

        text: {
          body: aiMessage || node?.message || "Hola 👋",
        },
      }
),
  }
);

const data = await response.json();

console.log("RESPUESTA META:", data);
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response("Error", { status: 500 });
  }
}

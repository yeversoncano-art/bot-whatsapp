import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);
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
      const selectedNode =
  message?.interactive?.button_reply?.id ||
  "bienvenida_velas";
      const clientResult = await supabase
  .from("clients")
  .upsert(
    {
      phone: from,
      last_node: selectedNode,
    },
    {
      onConflict: "phone",
    }
  );

console.log("CLIENT RESULT:", clientResult);
      
const { data: node, error } = await supabase
  .from("nodes")
  .select("*")
  .eq("node_key", selectedNode)
  .single();

console.log("NODO:", node);
      console.log("ERROR SUPABASE:", error);
      const buttons = (node?.buttons || []).slice(0, 3).map((btn, index) => ({
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
            text: node?.message || "Hola 👋",
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
          body: node?.message || "Hola 👋",
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

import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
function normalizeText(text = "") {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}
const objectionWords = [
  "caro",
  "muy caro",
  "costoso",
  "no tengo dinero",
  "sin dinero",
  "no puedo pagar",
  "no tengo tiempo",
  "no se si funciona",
  "no sé si funciona",
  "funciona",
  "desconfio",
  "desconfío",
  "dificil",
  "difícil",
  "no tengo experiencia",
  "soy principiante",
  "vale la pena"
];
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

  const statuses =
    body.entry?.[0]?.changes?.[0]?.value?.statuses;

  if (statuses) {
    return new Response("OK", { status: 200 });
  }

  if (!message) {
    return new Response("OK", { status: 200 });
  }

  if (message) {
      const from = message.from;
      const contactName =
  body.entry?.[0]?.changes?.[0]?.value?.contacts?.[0]?.profile?.name || "";
 const userText = normalizeText(
  message?.text?.body || ""
);

await supabase
  .from("mensajes")
  .insert({
    telefono: from,
    mensaje: userText,
    tipo: "user",
    created_at: new Date(),
  });

const isObjection = objectionWords.some(
  (word) => userText.includes(word)
);
    
const { data: existingClient } = await supabase
  .from("clients")
  .select("*")
  .eq("phone", from)
  .single();

let selectedNode =
  message?.interactive?.button_reply?.id || null;

if (
  message.type === "image" &&
  existingClient?.status === "esperando_comprobante"
) {

  selectedNode = "acceso";

  await supabase
    .from("clients")
    .update({
      status: "cliente",
    })
    .eq("phone", from);
}

if (isObjection) {
  selectedNode = "ia_libre";
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
      status: "esperando_comprobante",
      checkout_at: new Date(),
    })
    .eq("phone", from);
}

// PRIMERA INTERACCION
if (!selectedNode && !existingClient?.last_node) {
  selectedNode = "bienvenida";
}

// MENSAJES ESCRITOS
if (
  userText &&
  !isObjection &&
  !message?.interactive?.button_reply?.id
) {

  const { data: allNodes } = await supabase
  .from("nodes")
  .select("*")
  .eq("product_id", activeProduct.id);

  const matchedNode = allNodes?.find((n) =>
    (n.keywords || []).some((kw) =>
      userText.includes(
        normalizeText(kw)
      )
    )
  );

  console.log("USER TEXT:", userText);
console.log("MATCHED NODE:", matchedNode);
  
  if (matchedNode) {
    selectedNode = matchedNode.node_key;
  }
else {

  if (
    existingClient?.last_node &&
    userText.length > 10
  ) {
    selectedNode = "ia_libre";
  }

  else {
    selectedNode =
      existingClient?.last_node ||
      "bienvenida";
  }

}
}

// FALLBACK FINAL
if (!selectedNode) {
  selectedNode =
    existingClient?.last_node ||
    "ia_libre";
}

const { data: node, error } = await supabase
  .from("nodes")
  .select("*")
  .eq("node_key", selectedNode)
  .single();

if (node?.product_id) {
  await supabase
    .from("clients")
    .update({
      current_product: node.product_id,
    })
    .eq("phone", from);

  if (existingClient) {
  existingClient.current_product =
    node.product_id;
}
}
let currentProductId =
  node?.product_id ||
  existingClient?.current_product;

const { data: product } = await supabase
  .from("products")
  .select("*")
  .eq("id", currentProductId)
  .single();
    
// GUARDAR CLIENTE
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

// MARCAR INTERESADO
if (selectedNode === "precio_velas") {
  await supabase
    .from("clients")
    .update({
      status: "interesado",
    })
    .eq("phone", from);
}

console.log("PRODUCT:", product);
console.log("NODO:", node);
console.log("NODE MESSAGE:", node?.message);
console.log("USE AI:", node?.use_ai);
console.log("SELECTED NODE:", selectedNode);
console.log("ERROR SUPABASE:", error);
      let aiMessage = null;

const hasMedia =
  Array.isArray(node?.media) &&
  node.media.length > 0;

if (
  node?.use_ai &&
  (
    isObjection ||
    selectedNode === "ia_libre"
  ) &&
 !message?.interactive?.button_reply?.id
) {

  const completion =
    await openai.chat.completions.create({

      model: "gpt-4o-mini",

      messages: [
        {
          role: "system",
          content: `
Eres un vendedor amable especializado en cursos digitales.

NODO ACTUAL:
${selectedNode}

MENSAJE DEL NODO:
${selectedNode === "ia_libre"
  ? ""
  : node?.message}
PRODUCTO:
${activeProduct?.name}

DESCRIPCIÓN:
${activeProduct?.description}

PROMESA:
${activeProduct?.promise}

PRECIO:
${activeProduct?.price} ${activeProduct?.currency}

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

  aiMessage =
    completion.choices[0].message.content;
}
      const { data: clientData } = await supabase
  .from("clients")
  .select("*")
  .eq("phone", from)
  .single();
const buttons =
  clientData?.status === "cliente"
    ? []
    : (node?.buttons || [])
        .slice(0, 3)
        .map((btn) => ({
          type: "reply",
          reply: {
            id: btn.destino,
            title: btn.texto
              .replace(/[^\w\s]/gi, "")
              .substring(0, 20),
          },
        }));

console.log("BUTTONS:", buttons);

if (Array.isArray(node?.media)) {

for (const item of node.media) {

    if (
  item.type === "text" &&
  buttons.length === 0
) {

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
            to: from,
            type: "text",
            text: {
              body: item.content,
            },
          }),
        }
      );
    }

    if (item.type === "image") {

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
            to: from,
            type: "image",
            image: {
              link: item.url,
            },
          }),
        }
      );
    }

    if (item.type === "video") {

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
            to: from,
            type: "video",
            video: {
              link: item.url,
            },
          }),
        }
      );
    }

    await new Promise(r => setTimeout(r, 700));
  }

}

if (buttons.length > 0) {

  const response = await fetch(
    `https://graph.facebook.com/v19.0/${process.env.PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: from,
        type: "interactive",

        interactive: {
          type: "button",

          body: {
            text:
              (
                aiMessage ||
                node?.message ||
                "👇 Selecciona una opción:"
              ).substring(0, 900),
          },

          action: {
            buttons,
          },
        },
      }),
    }
  );

  const data = await response.json();

console.log("RESPUESTA META:", data);

await supabase
  .from("mensajes")
  .insert({
    telefono: from,
    mensaje:
      aiMessage ||
      node?.message ||
      "Hola 👋",
    tipo: "bot",
    created_at: new Date(),
  });

}

else if (!node?.media?.length) {

  const response = await fetch(
    `https://graph.facebook.com/v19.0/${process.env.PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: from,
        type: "text",

        text: {
          body:
            aiMessage ||
            node?.message ||
            "Hola 👋",
        },
      }),
    }
  );

  const data = await response.json();

console.log("RESPUESTA META:", data);

await supabase
  .from("mensajes")
  .insert({
    telefono: from,
    mensaje:
      aiMessage ||
      node?.message ||
      "Hola 👋",
    tipo: "bot",
    created_at: new Date(),
  });
}
}
return new Response("OK", { status: 200 });

} catch (error) {
  console.error(error);
  return new Response("Error", { status: 500 });
}
}

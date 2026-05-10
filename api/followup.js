import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  const { data: clients } = await supabase
    .from("clients")
    .select("*")
    .eq("status", "interesado");

  console.log("CLIENTES INTERESADOS:", clients);
  for (const client of clients || []) {
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
          body:
            "Hola 😊 ¿Te quedaron dudas del curso? La oferta sigue disponible.",
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

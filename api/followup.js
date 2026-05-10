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

  return res.status(200).json({
    ok: true,
    clients,
  });
}

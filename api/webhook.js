export default function handler(req, res) {
  // 🔥 VERIFICACIÓN DE META (GET)
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === "token123") {
      return res.status(200).send(challenge);
    } else {
      return res.status(403).send("Error de verificación");
    }
  }

  // 🚀 MENSAJES (POST)
  if (req.method === "POST") {
    console.log("Mensaje recibido:", req.body);
    return res.status(200).send("OK");
  }

  return res.status(405).send("Method Not Allowed");
}

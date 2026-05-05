export default function handler(req, res) {
  if (req.method === "POST") {
    console.log("Mensaje recibido:", req.body);
    return res.status(200).send("OK");
  }

  return res.status(405).send("Method Not Allowed");
}

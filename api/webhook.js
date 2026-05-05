export async function POST(req) {
  const body = await req.json();

  console.log("Mensaje recibido:", body);

  return new Response("OK", { status: 200 });
}

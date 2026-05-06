export async function GET(req) {
  const { searchParams } = new URL(req.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === "mi_token_123") {
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

      await fetch(
        "https://graph.facebook.com/v19.0/1027767230424897/messages",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer EAAXjs43b9icBRJZBrx2T8ZCZCTkmJ5ZCYGZAIm4ElhNx9NyflZB20B5IvaQrsBI5v9akaqQta28i9Sz2NYYsbNc4Rh3ce6vmAHZBAdMJM6ZACVMlA4I5e2qW6F15fW4or9FnnoPbEyeyj2KBocZAJhR9G3VxqSlLiUqGRmd3NROjsFgfrkPYlMipjUwk3wJDJagZDZD",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: from,
            type: "text",
            text: {
              body: "Hola 👋 soy tu asistente",
            },
          }),
        }
      );
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response("Error", { status: 500 });
  }
}

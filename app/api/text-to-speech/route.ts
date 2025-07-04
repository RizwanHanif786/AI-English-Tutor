/* app/api/text-to-speech/route.ts
   Turn text into speech by POSTing to OpenAI’s /v1/audio/speech endpoint */

export async function POST(req: Request) {
  try {
    const { text } = await req.json()

    if (!text) {
      return new Response("No text provided", { status: 400 })
    }

    const openaiRes = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY!}`,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        model: "tts-1", // or "tts-1-hd" if you have access
        input: text,
        voice: "nova", // alloy | echo | fable | onyx | nova | shimmer
        speed: 0.9,
      }),
    })

    if (!openaiRes.ok) {
      console.error("TTS API error:", await openaiRes.text())
      return new Response("Failed to generate speech", { status: 502 })
    }

    const audioArrayBuffer = await openaiRes.arrayBuffer()

    return new Response(audioArrayBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audioArrayBuffer.byteLength),
      },
    })
  } catch (err) {
    console.error("Text-to-speech route error:", err)
    return new Response("Error generating speech", { status: 500 })
  }
}

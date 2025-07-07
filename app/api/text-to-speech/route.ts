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
        model: "tts-1-hd", // Higher quality model for clearer voice
        input: text,
        voice: "nova", // Clear female voice
        speed: 0.95, // Slightly slower for clarity
        response_format: "mp3",
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
        "Cache-Control": "no-cache",
      },
    })
  } catch (err) {
    console.error("Text-to-speech route error:", err)
    return new Response("Error generating speech", { status: 500 })
  }
}

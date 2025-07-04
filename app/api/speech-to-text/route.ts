/* app/api/speech-to-text/route.ts
   Whisper STT via raw fetch to avoid SDK stream issues in next-lite  */

export async function POST(req: Request) {
  try {
    const formDataIn = await req.formData()
    const audio = formDataIn.get("audio") as File | null

    if (!audio) {
      return new Response("No audio file provided", { status: 400 })
    }

    /* Build the multipart body expected by
       POST https://api.openai.com/v1/audio/transcriptions        */
    const openaiBody = new FormData()
    openaiBody.append("file", audio, "audio.webm")
    openaiBody.append("model", "whisper-1")
    openaiBody.append("language", "en")

    const openaiRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY!}`,
      },
      body: openaiBody,
    })

    if (!openaiRes.ok) {
      console.error("Whisper API error:", await openaiRes.text())
      return new Response("Failed to transcribe audio", { status: 502 })
    }

    const data: { text: string } = await openaiRes.json()
    return Response.json({ text: data.text })
  } catch (err) {
    console.error("Speech-to-text route error:", err)
    return new Response("Error processing audio", { status: 500 })
  }
}

function safeParseJSON(raw: string): any | null {
  // Remove triple-back-tick fences if the model added them
  const cleaned = raw
    .trim()
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim()

  // Grab the first “{ … }” block to ignore stray text
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (!match) return null

  try {
    return JSON.parse(match[0])
  } catch {
    return null
  }
}

import { openai } from "@ai-sdk/openai"
import { generateText } from "ai"

export async function POST(req: Request) {
  try {
    const { messages } = await req.json()

    // Get the last user message for grammar analysis
    const lastUserMessage = messages[messages.length - 1]
    const userText = lastUserMessage?.content || ""

    // First, check for grammar errors
    let grammarCorrection = null
    let explanation = null

    if (userText.trim()) {
      const grammarCheckPrompt = `Analyze this sentence for grammatical errors: "${userText}"

If there are grammatical mistakes, respond with ONLY a JSON object in this exact format:
{
  "hasErrors": true,
  "correctedSentence": "The grammatically correct version here",
  "explanation": "Brief explanation of what was wrong"
}

If the sentence is grammatically correct, respond with:
{
  "hasErrors": false,
  "correctedSentence": null,
  "explanation": null
}

Do not include any other text outside the JSON.`

      try {
        const grammarResult = await generateText({
          model: openai("gpt-4o"),
          prompt: grammarCheckPrompt,
          temperature: 0.3,
          maxTokens: 200,
        })

        const grammarData = safeParseJSON(grammarResult.text)
        if (grammarData?.hasErrors) {
          grammarCorrection = grammarData.correctedSentence
          explanation = grammarData.explanation
        }
      } catch (error) {
        console.error("Grammar check error:", error)
      }
    }

    // Then get conversational response
    const conversationPrompt = `You are Emma, a friendly and encouraging English conversation tutor. You're having a natural voice conversation with a student.

IMPORTANT GUIDELINES:
- Keep responses SHORT (1-2 sentences max) since this is a voice conversation
- Speak naturally and conversationally, like you're talking to a friend
- Use contractions (I'm, you're, that's, etc.) to sound more natural
- Ask engaging follow-up questions to keep the conversation flowing
- Be encouraging and supportive about their English practice
- Vary topics: daily life, hobbies, interests, experiences
- Respond as if you're having a real-time voice chat
- Keep the energy positive and engaging
- Use simple, clear language appropriate for language learners
- DO NOT mention grammar corrections in your response - that's handled separately
- Just respond naturally to what they said

Remember: This is a VOICE conversation, so keep it natural and conversational!`

    const conversationResult = await generateText({
      model: openai("gpt-4o"),
      messages: [{ role: "system", content: conversationPrompt }, ...messages],
      temperature: 0.8,
      maxTokens: 150,
    })

    // Get Urdu translation
    let urduTranslation = "Translation not available"
    try {
      const translationResult = await generateText({
        model: openai("gpt-4o"),
        prompt: `Translate this English text to Urdu: "${conversationResult.text}"
        
Respond with ONLY the Urdu translation, no other text.`,
        temperature: 0.3,
        maxTokens: 100,
      })
      urduTranslation = translationResult.text.replace(/```/g, "").trim()
    } catch (error) {
      console.error("Translation error:", error)
    }

    return Response.json({
      response: conversationResult.text,
      grammarCorrection,
      explanation,
      urduTranslation,
    })
  } catch (error) {
    console.error("Error in chat API:", error)
    return new Response("Error processing request", { status: 500 })
  }
}

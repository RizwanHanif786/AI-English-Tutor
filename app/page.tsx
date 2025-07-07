"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Mic, MicOff, VolumeX, Phone, PhoneOff, Languages, CheckCircle } from "lucide-react"
import { EmmaAvatar } from "@/components/emma-avatar"

interface Message {
  role: "user" | "assistant"
  content: string
  timestamp: Date
  grammarCorrection?: string | null
  explanation?: string | null
  urduTranslation?: string
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null
  onend: ((this: SpeechRecognition, ev: Event) => any) | null
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message: string
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition
    webkitSpeechRecognition: new () => SpeechRecognition
  }
}

export default function VoiceChatTutor() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [currentTranscript, setCurrentTranscript] = useState("")
  const [showUrdu, setShowUrdu] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    // Initialize with a welcome message
    if (messages.length === 0) {
      const welcomeMessage: Message = {
        role: "assistant",
        content:
          "Hi! I'm Emma, your English conversation partner. I'll help you practice and correct your grammar. Ready to start?",
        timestamp: new Date(),
        urduTranslation:
          "ہیلو! میں ایما ہوں، آپ کی انگریزی بات چیت کی ساتھی۔ میں آپ کو مشق کرنے اور گرامر درست کرنے میں مدد کروں گی۔ شروع کرنے کے لیے تیار ہیں؟",
      }
      setMessages([welcomeMessage])

      // Speak the welcome message
      setTimeout(() => {
        speakText(welcomeMessage.content)
      }, 1000)
    }
  }, [])

  const getEmmaState = () => {
    if (isRecording) return "listening"
    if (isProcessing) return "thinking"
    if (isSpeaking) return "speaking"
    return "idle"
  }

  const startConversation = async () => {
    setIsConnected(true)
    const starterMessage: Message = {
      role: "assistant",
      content: "Perfect! Let's start chatting. Tell me about your day or ask me anything!",
      timestamp: new Date(),
      urduTranslation: "بہترین! آئیے بات چیت شروع کرتے ہیں۔ مجھے اپنے دن کے بارے میں بتائیں یا کوئی بھی سوال پوچھیں!",
    }
    setMessages((prev) => [...prev, starterMessage])
    await speakText(starterMessage.content)
  }

  const endConversation = () => {
    setIsConnected(false)
    setIsRecording(false)
    setIsSpeaking(false)
    if (audioRef.current) {
      audioRef.current.pause()
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop()
    }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      })

      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm;codecs=opus" })
        await processAudio(audioBlob)
        stream.getTracks().forEach((track) => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
      setCurrentTranscript("Listening...")
    } catch (error) {
      console.error("Error starting recording:", error)
      alert("Could not access microphone. Please check permissions.")
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      setCurrentTranscript("Processing...")
    }
  }

  const processAudio = async (audioBlob: Blob) => {
    setIsProcessing(true)

    try {
      // Convert audio to text using OpenAI Whisper
      const formData = new FormData()
      formData.append("audio", audioBlob, "audio.webm")

      const transcriptionResponse = await fetch("/api/speech-to-text", {
        method: "POST",
        body: formData,
      })

      if (!transcriptionResponse.ok) {
        throw new Error("Failed to transcribe audio")
      }

      const { text } = await transcriptionResponse.json()
      setCurrentTranscript("")

      if (!text.trim()) {
        setIsProcessing(false)
        return
      }

      // Add user message first
      const userMessage: Message = {
        role: "user",
        content: text,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, userMessage])

      // Get AI response with grammar analysis
      const chatResponse = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      })

      if (!chatResponse.ok) {
        throw new Error("Failed to get AI response")
      }

      const aiResponseData = await chatResponse.json()

      // Update user message with grammar correction if found
      if (aiResponseData.grammarCorrection) {
        setMessages((prev) => {
          const updated = [...prev]
          const lastUserIndex = updated.length - 1
          updated[lastUserIndex] = {
            ...updated[lastUserIndex],
            grammarCorrection: aiResponseData.grammarCorrection,
            explanation: aiResponseData.explanation,
          }
          return updated
        })
      }

      // Add AI response message
      const aiMessage: Message = {
        role: "assistant",
        content: aiResponseData.response || "I didn't understand that. Could you try again?",
        timestamp: new Date(),
        urduTranslation: aiResponseData.urduTranslation || "Translation not available",
      }

      setMessages((prev) => [...prev, aiMessage])

      // Convert AI response to speech and play
      await speakText(aiMessage.content)
    } catch (error) {
      console.error("Error processing audio:", error)
      setCurrentTranscript("Sorry, there was an error processing your message.")
    } finally {
      setIsProcessing(false)
    }
  }

  const speakText = async (text: string) => {
    try {
      setIsSpeaking(true)

      const response = await fetch("/api/text-to-speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      })

      if (!response.ok) {
        throw new Error("Failed to generate speech")
      }

      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)

      if (audioRef.current) {
        audioRef.current.src = audioUrl
        audioRef.current.volume = 0.9 // Set volume to 90% for louder, clearer audio
        audioRef.current.playbackRate = 1.0 // Normal speed

        audioRef.current.onended = () => {
          setIsSpeaking(false)
          URL.revokeObjectURL(audioUrl)
        }
        audioRef.current.onerror = () => {
          setIsSpeaking(false)
          URL.revokeObjectURL(audioUrl)
        }

        // Ensure audio plays with proper volume
        await audioRef.current.play()
      }
    } catch (error) {
      console.error("Error playing speech:", error)
      setIsSpeaking(false)
    }
  }

  const stopSpeaking = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    setIsSpeaking(false)
  }

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">🎙️ Voice Chat with AI English Tutor</h1>
          <p className="text-gray-600 text-lg">Practice English with grammar correction and Urdu translation</p>
        </div>

        {/* Emma Avatar */}
        <div className="flex justify-center mb-6">
          <EmmaAvatar state={getEmmaState()} />
        </div>

        {/* Connection Status */}
        <div className="flex justify-center mb-6 gap-4">
          {!isConnected ? (
            <Button
              onClick={startConversation}
              className="bg-green-500 hover:bg-green-600 text-white px-8 py-3 rounded-full text-lg font-medium flex items-center gap-2"
            >
              <Phone className="w-5 h-5" />
              Start Voice Chat
            </Button>
          ) : (
            <Button
              onClick={endConversation}
              variant="destructive"
              className="px-8 py-3 rounded-full text-lg font-medium flex items-center gap-2"
            >
              <PhoneOff className="w-5 h-5" />
              End Chat
            </Button>
          )}

          <Button
            onClick={() => setShowUrdu(!showUrdu)}
            variant="outline"
            className="px-6 py-3 rounded-full flex items-center gap-2"
          >
            <Languages className="w-4 h-4" />
            {showUrdu ? "Hide Urdu" : "Show Urdu"}
          </Button>
        </div>

        {/* Chat Messages */}
        <Card className="mb-6 h-96 overflow-y-auto p-6 bg-white/90 backdrop-blur-sm shadow-lg">
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div key={index} className="space-y-2">
                <div className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className="flex items-start gap-3 max-w-xs lg:max-w-md">
                    {message.role === "assistant" && (
                      <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                        E
                      </div>
                    )}
                    <div className="space-y-2">
                      <div
                        className={`px-4 py-3 rounded-2xl ${
                          message.role === "user"
                            ? "bg-blue-500 text-white rounded-br-sm"
                            : "bg-gray-100 text-gray-800 rounded-bl-sm"
                        } transition-all duration-300 ease-in-out transform hover:scale-105`}
                      >
                        <p className="text-sm leading-relaxed">{message.content}</p>
                        <p className="text-xs opacity-70 mt-1">
                          {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>

                      {/* Grammar Correction */}
                      {message.grammarCorrection && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm">
                          <div className="flex items-center gap-2 mb-1">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            <span className="font-medium text-green-700">Grammar Correction:</span>
                          </div>
                          <p className="text-green-800 font-medium">"{message.grammarCorrection}"</p>
                          {message.explanation && <p className="text-gray-600 mt-1 text-xs">{message.explanation}</p>}
                        </div>
                      )}

                      {/* Urdu Translation */}
                      {showUrdu && message.urduTranslation && message.role === "assistant" && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                          <div className="flex items-center gap-2 mb-1">
                            <Languages className="w-4 h-4 text-blue-500" />
                            <span className="font-medium text-blue-700">Urdu Translation:</span>
                          </div>
                          <p className="text-blue-800 font-medium" dir="rtl">
                            {message.urduTranslation}
                          </p>
                        </div>
                      )}
                    </div>
                    {message.role === "user" && (
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                        You
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {isProcessing && (
              <div className="flex justify-start">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                    E
                  </div>
                  <div className="bg-gray-100 text-gray-800 px-4 py-3 rounded-2xl rounded-bl-sm">
                    <div className="flex items-center space-x-2">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"></div>
                        <div
                          className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"
                          style={{ animationDelay: "0.1s" }}
                        ></div>
                        <div
                          className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"
                          style={{ animationDelay: "0.2s" }}
                        ></div>
                      </div>
                      <span className="text-sm">Processing...</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </Card>

        {/* Current Transcript */}
        {currentTranscript && (
          <Card className="mb-6 p-4 bg-yellow-50 border border-yellow-200">
            <p className="text-sm text-yellow-800">
              <span className="font-medium">🎤</span> {currentTranscript}
            </p>
          </Card>
        )}

        {/* Voice Controls */}
        {isConnected && (
          <div className="flex flex-col items-center space-y-6">
            <div className="flex items-center space-x-4">
              {/* Main Voice Button */}
              <Button
                onClick={toggleRecording}
                disabled={isProcessing || isSpeaking}
                className={`w-24 h-24 rounded-full transition-all duration-300 transform hover:scale-110 shadow-lg ${
                  isRecording
                    ? "bg-red-500 hover:bg-red-600 animate-pulse shadow-red-300"
                    : "bg-blue-500 hover:bg-blue-600 shadow-blue-300"
                } ${isProcessing || isSpeaking ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {isRecording ? <MicOff className="w-10 h-10 text-white" /> : <Mic className="w-10 h-10 text-white" />}
              </Button>

              {/* Stop Speaking Button */}
              {isSpeaking && (
                <Button
                  onClick={stopSpeaking}
                  variant="outline"
                  className="px-6 py-3 border-red-300 text-red-600 hover:bg-red-50 bg-white/80 backdrop-blur-sm"
                >
                  <VolumeX className="w-4 h-4 mr-2" />
                  Stop
                </Button>
              )}
            </div>

            {/* Status Text */}
            <div className="text-center">
              {isRecording && (
                <p className="text-red-600 font-medium animate-pulse text-lg">🎤 Recording... Speak now!</p>
              )}
              {isProcessing && <p className="text-blue-600 font-medium text-lg">🤔 Processing your message...</p>}
              {isSpeaking && <p className="text-green-600 font-medium text-lg">🔊 Emma is speaking...</p>}
              {!isRecording && !isProcessing && !isSpeaking && (
                <p className="text-gray-600 text-lg">💬 Click the microphone to speak</p>
              )}
            </div>

            {/* Instructions */}
            <div className="text-center text-sm text-gray-500 max-w-lg bg-white/60 backdrop-blur-sm rounded-lg p-4">
              <p className="mb-2">
                <strong>💡 New Features:</strong>
              </p>
              <p>
                ✅ <strong>Grammar Correction:</strong> Emma will correct your mistakes and explain them
                <br />🌍 <strong>Urdu Translation:</strong> Toggle to see responses in Urdu
                <br />🤖 <strong>Animated Emma:</strong> Watch Emma's expressions change as she listens and speaks!
              </p>
            </div>
          </div>
        )}

        {/* Hidden audio element for playback */}
        <audio ref={audioRef} className="hidden" />
      </div>
    </div>
  )
}

"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Mic, MicOff, Volume2, VolumeX, Phone, PhoneOff } from "lucide-react"

interface Message {
  role: "user" | "assistant"
  content: string
  timestamp: Date
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
          "Hi! I'm Emma, your English conversation partner. Ready to practice? Just click the microphone and start talking!",
        timestamp: new Date(),
      }
      setMessages([welcomeMessage])

      // Speak the welcome message
      setTimeout(() => {
        speakText(welcomeMessage.content)
      }, 1000)
    }
  }, [])

  const startConversation = async () => {
    setIsConnected(true)
    // Add a conversation starter
    const starterMessage: Message = {
      role: "assistant",
      content: "Great! Let's start chatting. How's your day going so far?",
      timestamp: new Date(),
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

        // Stop all tracks to release microphone
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

      // Add user message
      const userMessage: Message = {
        role: "user",
        content: text,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, userMessage])

      // Get AI response
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

      const { text: aiResponse } = await chatResponse.json()

      // Add AI message
      const aiMessage: Message = {
        role: "assistant",
        content: aiResponse,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, aiMessage])

      // Convert AI response to speech and play
      await speakText(aiResponse)
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
        audioRef.current.onended = () => {
          setIsSpeaking(false)
          URL.revokeObjectURL(audioUrl)
        }
        audioRef.current.onerror = () => {
          setIsSpeaking(false)
          URL.revokeObjectURL(audioUrl)
        }
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
          <p className="text-gray-600 text-lg">
            Have a natural voice conversation to practice your English speaking skills
          </p>
        </div>

        {/* Connection Status */}
        <div className="flex justify-center mb-6">
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
        </div>

        {/* Chat Messages */}
        <Card className="mb-6 h-96 overflow-y-auto p-6 bg-white/90 backdrop-blur-sm shadow-lg">
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className="flex items-start gap-3 max-w-xs lg:max-w-md">
                  {message.role === "assistant" && (
                    <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                      E
                    </div>
                  )}
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
                  {message.role === "user" && (
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                      You
                    </div>
                  )}
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

            {isSpeaking && (
              <div className="flex justify-start">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                    E
                  </div>
                  <div className="bg-green-100 text-green-800 px-4 py-3 rounded-2xl rounded-bl-sm border border-green-200">
                    <div className="flex items-center space-x-2">
                      <Volume2 className="w-4 h-4 animate-pulse" />
                      <span className="text-sm">Emma is speaking...</span>
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
                <strong>💡 How it works:</strong>
              </p>
              <p>
                1. Click the microphone and speak naturally
                <br />
                2. Emma will listen, understand, and respond with her voice
                <br />
                3. Have a real conversation just like talking to a friend!
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

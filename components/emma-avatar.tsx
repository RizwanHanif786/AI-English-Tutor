"use client"

import { useEffect, useState } from "react"

interface EmmaAvatarProps {
  state: "idle" | "listening" | "thinking" | "speaking"
  className?: string
}

export function EmmaAvatar({ state, className = "" }: EmmaAvatarProps) {
  const [blinkAnimation, setBlinkAnimation] = useState(false)

  useEffect(() => {
    // Blink animation every 3-5 seconds
    const blinkInterval = setInterval(
      () => {
        setBlinkAnimation(true)
        setTimeout(() => setBlinkAnimation(false), 150)
      },
      Math.random() * 2000 + 3000,
    )

    return () => clearInterval(blinkInterval)
  }, [])

  const getExpression = () => {
    switch (state) {
      case "listening":
        return {
          eyebrows: "translate-y-1",
          eyes: blinkAnimation ? "scale-y-0" : "scale-y-100",
          mouth: "rounded-full w-3 h-2",
          cheeks: "bg-pink-200",
          animation: "animate-pulse",
        }
      case "thinking":
        return {
          eyebrows: "translate-y-0 rotate-12",
          eyes: blinkAnimation ? "scale-y-0" : "scale-y-100 translate-x-1",
          mouth: "rounded-full w-2 h-2 translate-x-1",
          cheeks: "bg-pink-100",
          animation: "",
        }
      case "speaking":
        return {
          eyebrows: "translate-y-0",
          eyes: blinkAnimation ? "scale-y-0" : "scale-y-100",
          mouth: "rounded-full w-4 h-3 animate-pulse",
          cheeks: "bg-pink-300",
          animation: "animate-bounce",
        }
      default:
        return {
          eyebrows: "translate-y-0",
          eyes: blinkAnimation ? "scale-y-0" : "scale-y-100",
          mouth: "rounded-full w-3 h-2",
          cheeks: "bg-pink-100",
          animation: "",
        }
    }
  }

  const expression = getExpression()

  return (
    <div className={`relative ${className} ${expression.animation}`}>
      {/* Head */}
      <div className="w-24 h-24 bg-gradient-to-b from-pink-100 to-pink-50 rounded-full border-4 border-purple-200 shadow-lg relative overflow-hidden">
        {/* Hair */}
        <div className="absolute -top-2 -left-2 -right-2 h-16 bg-gradient-to-b from-purple-400 to-purple-300 rounded-full"></div>
        <div className="absolute top-2 left-3 w-4 h-8 bg-purple-300 rounded-full transform -rotate-12"></div>
        <div className="absolute top-2 right-3 w-4 h-8 bg-purple-300 rounded-full transform rotate-12"></div>

        {/* Face */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-4">
          {/* Eyebrows */}
          <div className="flex space-x-4 mb-1">
            <div
              className={`w-3 h-1 bg-purple-600 rounded-full transform transition-all duration-300 ${expression.eyebrows}`}
            ></div>
            <div
              className={`w-3 h-1 bg-purple-600 rounded-full transform transition-all duration-300 ${expression.eyebrows}`}
            ></div>
          </div>

          {/* Eyes */}
          <div className="flex space-x-3 mb-2">
            <div className="relative">
              <div className="w-3 h-3 bg-white rounded-full border border-gray-300">
                <div
                  className={`w-2 h-2 bg-purple-600 rounded-full absolute top-0.5 left-0.5 transform transition-all duration-150 ${expression.eyes}`}
                ></div>
              </div>
            </div>
            <div className="relative">
              <div className="w-3 h-3 bg-white rounded-full border border-gray-300">
                <div
                  className={`w-2 h-2 bg-purple-600 rounded-full absolute top-0.5 left-0.5 transform transition-all duration-150 ${expression.eyes}`}
                ></div>
              </div>
            </div>
          </div>

          {/* Cheeks */}
          <div className="flex space-x-6 mb-1 absolute top-8">
            <div className={`w-2 h-2 rounded-full transition-all duration-300 ${expression.cheeks}`}></div>
            <div className={`w-2 h-2 rounded-full transition-all duration-300 ${expression.cheeks}`}></div>
          </div>

          {/* Mouth */}
          <div className={`bg-pink-400 transition-all duration-300 ${expression.mouth}`}></div>
        </div>

        {/* Decorative elements */}
        <div className="absolute top-6 right-2 w-1 h-1 bg-yellow-300 rounded-full animate-twinkle"></div>
        <div
          className="absolute top-8 left-1 w-1 h-1 bg-blue-300 rounded-full animate-twinkle"
          style={{ animationDelay: "1s" }}
        ></div>
      </div>

      {/* Name tag */}
      <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-purple-500 text-white px-2 py-1 rounded-full text-xs font-bold">
        Emma
      </div>

      {/* State indicator */}
      <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs">
        {state === "listening" && <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>}
        {state === "thinking" && <div className="w-3 h-3 bg-yellow-500 rounded-full animate-spin">💭</div>}
        {state === "speaking" && <div className="w-3 h-3 bg-green-500 rounded-full animate-bounce">🗣️</div>}
        {state === "idle" && <div className="w-3 h-3 bg-gray-300 rounded-full">😊</div>}
      </div>
    </div>
  )
}

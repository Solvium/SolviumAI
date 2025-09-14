"use client"

import { useAuth } from "@/app/contexts/AuthContext"
import { useEffect, useState } from "react"

interface StatusBar3DProps {
  className?: string
}

const StatusBar3D = ({ className = "" }: StatusBar3DProps) => {
  const { user: userDetails } = useAuth()
  const [animatedPoints, setAnimatedPoints] = useState(0)
  const [animatedRefs, setAnimatedRefs] = useState(0)
  const [animatedMultiplier, setAnimatedMultiplier] = useState(1)

  useEffect(() => {
    const animateValue = (current: number, target: number, setter: (value: number) => void, duration = 1000) => {
      const startTime = Date.now()
      const startValue = current
      const difference = target - startValue

      const animate = () => {
        const elapsed = Date.now() - startTime
        const progress = Math.min(elapsed / duration, 1)
        const easeOutQuart = 1 - Math.pow(1 - progress, 4)
        const currentValue = startValue + difference * easeOutQuart

        setter(Math.round(currentValue * 100) / 100)

        if (progress < 1) {
          requestAnimationFrame(animate)
        }
      }

      requestAnimationFrame(animate)
    }

    if (userDetails) {
      animateValue(animatedPoints, userDetails.totalPoints || 0, setAnimatedPoints)
      animateValue(animatedRefs, userDetails.referralCount || 0, setAnimatedRefs)
      animateValue(animatedMultiplier, userDetails.multiplier || 1, setAnimatedMultiplier)
    }
  }, [userDetails]) // Updated to use the entire userDetails object

  const getProgressWidth = (current: number, max: number) => {
    return Math.min((current / max) * 100, 100)
  }

  return (
    <div className={`flex items-center justify-between gap-2 sm:gap-4 p-2 sm:p-4 ${className}`}>
      <div className="relative flex items-center">
        <div className="relative">
          <img src="/assets/status/gifts-bar.png" alt="Points" className="h-10 sm:h-8 w-auto" />
          <div
            className="absolute top-1/2 left-8 h-2 bg-gradient-to-r from-orange-400 to-orange-600 rounded-full transition-all duration-1000 ease-out transform -translate-y-1/2"
            style={{
              width: `${getProgressWidth(animatedPoints, 10000)}%`,
              maxWidth: "60px",
            }}
          />
        </div>
        {/* <span className="absolute right-2 text-white font-black text-xs sm:text-sm drop-shadow-lg">
          {Math.round(animatedPoints).toLocaleString()}
        </span> */}
      </div>

      <div className="relative flex items-center">
        <div className="relative">
          <img src="/assets/status/coin-progress.png" alt="Refs" className="h-10 sm:h-8 w-auto" />
          <div
            className="absolute top-1/2 left-6 h-2 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full transition-all duration-1000 ease-out transform -translate-y-1/2"
            style={{
              width: `${getProgressWidth(animatedRefs, 100)}%`,
              maxWidth: "60px",
            }}
          />
        </div>
        {/* <span className="absolute right-2 text-white font-black text-xs sm:text-sm drop-shadow-lg">
          {Math.round(animatedRefs)}
        </span> */}
      </div>

      <div className="relative flex items-center">
        <div className="relative">
          <img src="/assets/status/star-bar.png" alt="Multiplier" className="h-10 sm:h-8 w-auto" />
          <div
            className="absolute top-1/2 left-8 h-2 bg-gradient-to-r from-yellow-300 to-yellow-500 rounded-full transition-all duration-1000 ease-out transform -translate-y-1/2"
            style={{
              width: `${getProgressWidth(animatedMultiplier, 10)}%`,
              maxWidth: "60px",
            }}
          />
        </div>
        {/* <span className="absolute right-2 text-white font-black text-xs sm:text-sm drop-shadow-lg">
          {animatedMultiplier.toFixed(1)}x
        </span> */}
      </div>
    </div>
  )
}

export default StatusBar3D

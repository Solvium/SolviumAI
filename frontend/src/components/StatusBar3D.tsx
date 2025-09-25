"use client"

import { useAuth } from "@/app/contexts/AuthContext"
import { useEffect, useState } from "react"

interface StatusBar3DProps {
  className?: string
}

const StatusBar3D = ({ className = "" }: StatusBar3DProps) => {
  const { user: userDetails } = useAuth()
  const [animatedGems, setAnimatedGems] = useState(0)
  const [animatedCoins, setAnimatedCoins] = useState(0)
  const [animatedLevel, setAnimatedLevel] = useState(1)

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
      animateValue(animatedGems, userDetails.totalPoints || 1416, setAnimatedGems)
      animateValue(animatedCoins, userDetails.referralCount * 100 || 28156, setAnimatedCoins)
      animateValue(animatedLevel, Math.floor((userDetails.multiplier || 1) * 10), setAnimatedLevel)
    }
  }, [userDetails])

  return (
    <div className={`flex items-center justify-between w-full px-4 py-2 ${className}`}>
      {/* Left side - Profile Avatar with XP Bar */}
      <div className="relative flex items-center">
        <div className="relative">
          <img
            src="/assets/hud/ui-profile-avatar-complete.png"
            alt="Profile Avatar Complete"
            className="h-12 w-auto sm:h-14"
          />
          {/* Player Level Badge overlay */}
          <div className="absolute -bottom-1 -right-1">
            <img
              src="/assets/hud/ui-profile-avatar-player-level-badge.png"
              alt="Level Badge"
              className="h-4 w-4 sm:h-5 sm:w-5"
            />
            <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold">
              {animatedLevel}
            </span>
          </div>
        </div>
      </div>

      {/* Right side - Currency Display */}
      <div className="flex items-center">
        <div className="relative">
          <img src="/assets/hud/currencies.png" alt="Currencies" className="h-8 w-auto sm:h-10" />
          {/* Overlay the animated values on the currency display */}
          <div className="absolute inset-0 flex items-center justify-between px-6">
            <span className="text-white font-bold text-xs sm:text-sm">{Math.round(animatedGems).toLocaleString()}</span>
            <span className="text-white font-bold text-xs sm:text-sm">
              {Math.round(animatedCoins).toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default StatusBar3D

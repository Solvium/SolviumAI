"use client"

import { useEffect, useState } from "react"
import { Copy } from 'lucide-react'
import type WebApp from "@twa-dev/sdk"
import { useAuth } from "@/app/contexts/AuthContext"
import { useToast } from "@/app/hooks/use-toast"
import Image from "next/image"

const UserProfile = ({ tg }: { tg: typeof WebApp | null }) => {
  const { user: userDetails } = useAuth()
  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-[#1a237e] via-[#283593] to-[#1a237e] relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pt-8">
        <button className="flex items-center gap-2 text-white">
          {/* Using provided back arrow icon */}
          <Image src="/src/app/assets/profile/back-icon.png" alt="Back" width={20} height={20} />
          <span className="text-lg font-medium">Back</span>
        </button>
        <button className="text-white">
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5" cy="12" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="19" cy="12" r="2" />
          </svg>
        </button>
      </div>

      <div className="max-w-sm mx-auto px-6 space-y-6">
        {/* Profile Section */}
        <ProfileHeader userDetails={userDetails} />

        {/* Level Progress Section */}
        <LevelProgress userDetails={userDetails} />

        {/* Stats Section */}
        <StatsSection userDetails={userDetails} />

        {/* Invite Section */}
        <InviteSection userDetails={userDetails} />
      </div>
    </div>
  )
}

const ProfileHeader = ({ userDetails }: any) => {
  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Avatar */}
      <div className="relative">
        {/* Using provided robot avatar image */}
        <Image 
          src="/src/app/assets/profile/robot-avatar.png" 
          alt="Robot Avatar" 
          width={96} 
          height={96}
          className="rounded-full"
        />
      </div>

      {/* Username */}
      <h1 className="text-2xl font-bold text-white">{userDetails?.username || "Clinton2965"}</h1>

      {/* Edit Profile Button */}
      <div className="relative">
        {/* Using provided edit profile button image */}
        <Image 
          src="/src/app/assets/profile/edit-profile-button.png" 
          alt="Edit Profile" 
          width={200} 
          height={60}
          className="cursor-pointer hover:opacity-90 transition-opacity"
        />
      </div>
    </div>
  )
}

const LevelProgress = ({ userDetails }: any) => {
  const currentPoints = userDetails?.totalPoints || 5200
  const nextLevelPoints = 6000
  const pointsToNext = nextLevelPoints - currentPoints
  const progress = (currentPoints / nextLevelPoints) * 100

  return (
    <div className="bg-blue-800/50 rounded-3xl p-6 border border-blue-600/30">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-sm">2</span>
          </div>
          <div>
            <h3 className="text-white font-bold text-lg">Level 2</h3>
            <p className="text-blue-300 text-sm">{pointsToNext} Points to next level</p>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative">
        <div className="flex items-center gap-3 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full p-1">
          <div className="flex items-center gap-2 px-4 py-2">
            <div className="w-4 h-4 bg-yellow-600 rounded-full flex items-center justify-center">
              <span className="text-xs text-white font-bold">2</span>
            </div>
            <span className="text-yellow-900 font-bold">★ {currentPoints}/6000</span>
          </div>
          <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center ml-auto mr-2">
            <span className="text-yellow-900 font-bold text-sm">3</span>
          </div>
        </div>
      </div>
    </div>
  )
}

const StatsSection = ({ userDetails }: any) => {
  return (
    <div className="grid grid-cols-3 gap-4">
      {/* Using provided stat cards image as background reference */}
      {/* Points */}
      <div className="bg-blue-800/50 rounded-3xl p-6 border border-blue-600/30 text-center">
        <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-400 rounded-full flex items-center justify-center mx-auto mb-3">
          <div className="w-8 h-8 bg-yellow-500 rounded-full"></div>
        </div>
        <div className="text-2xl font-bold text-white mb-1">{userDetails?.totalPoints || 100}</div>
        <div className="text-blue-300 text-sm font-medium uppercase tracking-wider">POINTS</div>
      </div>

      {/* Contests */}
      <div className="bg-blue-800/50 rounded-3xl p-6 border border-blue-600/30 text-center">
        <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-400 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-yellow-900" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </div>
        <div className="text-2xl font-bold text-white mb-1">3</div>
        <div className="text-blue-300 text-sm font-medium uppercase tracking-wider">CONTESTS</div>
      </div>

      {/* Tasks */}
      <div className="bg-blue-800/50 rounded-3xl p-6 border border-blue-600/30 text-center">
        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="text-2xl font-bold text-white mb-1">5</div>
        <div className="text-blue-300 text-sm font-medium uppercase tracking-wider">TASKS</div>
      </div>
    </div>
  )
}

const InviteSection = ({ userDetails }: any) => {
  const [copyState, setCopyState] = useState("Copy")
  const [link, setLink] = useState("")
  const { toast } = useToast()

  useEffect(() => {
    setLink(location.href)
  }, [])

  const handleCopy = async () => {
    const textToCopy = `${link}?ref=${userDetails?.username}`

    try {
      await navigator.clipboard.writeText(textToCopy)
      setCopyState("Copied")
      toast({
        title: "Copied!",
        description: "Invite link copied to clipboard",
        variant: "default",
      })
      setTimeout(() => setCopyState("Copy"), 2000)
    } catch (err) {
      console.error("Failed to copy: ", err)
      toast({
        title: "Copy Failed",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="bg-blue-800/50 rounded-3xl p-6 border border-blue-600/30">
      <h3 className="text-white font-bold text-center mb-4">Invite friends and earn rewards</h3>

      <button
        onClick={handleCopy}
        className="w-full bg-gradient-to-r from-yellow-400 to-orange-400 hover:from-yellow-500 hover:to-orange-500 text-yellow-900 font-bold py-4 px-6 rounded-2xl transition-all duration-200 flex items-center justify-center gap-2"
      >
        <span>{copyState}</span>
        <Copy className="w-4 h-4" />
      </button>
    </div>
  )
}

export default UserProfile

"use client"
import { useState, useEffect, useCallback } from "react"

import dynamic from "next/dynamic"
import { CONTRACTID, MEME_TOKEN_ADDRESS } from "./constants/contractId"
import { Bounce, toast, ToastContainer } from "react-toastify"
import BuySpin from "./BuySpin"
import { useMultiLoginContext } from "@/app/contexts/MultiLoginContext"
import { usePrivateKeyWallet } from "@/app/contexts/PrivateKeyWalletContext"
import StatusBar3D from "./StatusBar3D"
const Wheel = dynamic(() => import("react-custom-roulette").then((mod) => mod.Wheel), { ssr: false })

interface ClaimProps {
  rewardAmount: string
  onSuccess?: () => void
  onError?: (error: Error) => void
}

const WinPopup = ({
  isVisible,
  prize,
  onClaim,
  isClaimLoading,
}: {
  isVisible: boolean
  prize: string
  onClaim: () => void
  isClaimLoading: boolean
}) => {
  if (!isVisible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 rounded-3xl p-8 mx-4 max-w-sm w-full shadow-2xl animate-bounce">
        <div className="absolute -top-4 -left-4 w-8 h-8 bg-yellow-400 rounded-full animate-ping"></div>
        <div className="absolute -top-2 -right-6 w-6 h-6 bg-orange-400 rounded-full animate-ping delay-300"></div>
        <div className="absolute -bottom-3 -left-2 w-5 h-5 bg-green-400 rounded-full animate-ping delay-500"></div>
        <div className="absolute -bottom-4 -right-4 w-7 h-7 bg-purple-400 rounded-full animate-ping delay-700"></div>

        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">🎉</div>
          <h2 className="text-3xl font-black text-white mb-2 drop-shadow-lg">WINNER!</h2>
          <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-transparent bg-clip-text text-4xl font-black mb-6 drop-shadow-lg">
            {prize} TOKENS
          </div>
          <button
            onClick={onClaim}
            disabled={isClaimLoading}
            className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xl font-black rounded-2xl
                     hover:from-orange-600 hover:to-red-600 transition-all duration-300 transform hover:scale-105
                     disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {isClaimLoading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-t-2 border-white animate-spin rounded-full"></div>
                <span>CLAIMING...</span>
              </div>
            ) : (
              "CLAIM REWARD!"
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

const CountdownTimer = ({ targetTime }: { targetTime: Date }) => {
  const [timeLeft, setTimeLeft] = useState<number>(0)

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date(Date.now())
      const remaining = targetTime.getTime() - now.getTime()
      setTimeLeft(Math.max(0, remaining))
    }, 1000)

    return () => clearInterval(interval)
  }, [targetTime])

  const hours = Math.floor(timeLeft / (1000 * 60 * 60))
  const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000)

  return (
    <div className="text-white text-center bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-4">
      <div className="text-sm mb-1 font-semibold">Next spin available in</div>
      <div className="font-black text-xl text-yellow-400">
        {hours}h {minutes}m {seconds}s
      </div>
    </div>
  )
}

export const WheelOfFortune = () => {
  const { userData: user, claimPoints } = useMultiLoginContext()
  const {
    isConnected: nearConnected,
    accountId: nearAddress,
    signAndSendTransaction,
    checkTokenRegistration,
    registerToken,
  } = usePrivateKeyWallet()

  const [mustSpin, setMustSpin] = useState(false)
  const [prizeNumber, setPrizeNumber] = useState(0)
  const [winner, setWinner] = useState("")
  const [hasPlayed, setHasPlayed] = useState(false)
  const [isClaimed, setIsClaimed] = useState(false)
  const [unclaimed, setUnclaimed] = useState<{
    winner: string
    prizeNumber: number
  } | null>(null)

  const [spinningSound, setSpinningSound] = useState(new Audio())
  const [isClaimLoading, setIsClaimLoading] = useState(false)
  const [canClaim, setCanClaim] = useState(false)
  const [buySpins, setBuySpins] = useState(false)

  const [lastPlayed, setLastPlayed] = useState<number | null>(null)
  const [cooldownTime, setCooldownTime] = useState<Date>(new Date())

  const data = [
    { option: "1", style: { fontSize: 18, fontWeight: "900", color: "#FFFFFF" } },
    { option: "25", style: { fontSize: 18, fontWeight: "900", color: "#FFFFFF" } },
    { option: "50", style: { fontSize: 18, fontWeight: "900", color: "#FFFFFF" } },
    { option: "100", style: { fontSize: 18, fontWeight: "900", color: "#FFFFFF" } },
    { option: "250", style: { fontSize: 18, fontWeight: "900", color: "#FFFFFF" } },
    { option: "500", style: { fontSize: 18, fontWeight: "900", color: "#FFFFFF" } },
    { option: "1000", style: { fontSize: 18, fontWeight: "900", color: "#FFFFFF" } },
    { option: "2000", style: { fontSize: 18, fontWeight: "900", color: "#FFFFFF" } },
    { option: "5000", style: { fontSize: 18, fontWeight: "900", color: "#FFFFFF" } },
  ]

  const checkTokenRegistrationCallback = useCallback(async () => {
    if (!nearAddress) return null

    try {
      const result = await checkTokenRegistration(MEME_TOKEN_ADDRESS)
      return result
    } catch (error) {
      console.error("Token registration check failed:", error)
      return null
    }
  }, [nearAddress, checkTokenRegistration])

  const registerTokenCallback = async (tokenId: string) => {
    if (!nearAddress) return

    try {
      return await registerToken(tokenId)
    } catch (error) {
      console.error("Token registration failed:", error)
      throw error
    }
  }

  useEffect(() => {
    setSpinningSound(new Audio(location.origin + "/spin.mp3"))
    setLastPlayed(Number(user?.lastSpinClaim))
    const now = new Date(Date.now())
    const cooldownEnd = new Date(new Date(user?.lastSpinClaim ?? 0).getTime() + 24 * 60 * 60 * 1000)
    if (now < cooldownEnd) {
      setCooldownTime(cooldownEnd)
    }
    if ((user?.dailySpinCount ?? 0) <= 0) setHasPlayed(true)
    else setHasPlayed(false)

    const unclaimedPrize = localStorage.getItem("unclaimedPrize")
    const lastClaimedTime = localStorage.getItem("lastClaimed")
    if (unclaimedPrize && !lastClaimedTime) {
      const prize = JSON.parse(unclaimedPrize)
      setWinner(prize.winner)
      setPrizeNumber(prize.prizeNumber)
      setUnclaimed(prize)
      setIsClaimed(false)
    }
  }, [user])

  const handleClaimRewardImproved = async ({ rewardAmount, onSuccess, onError }: ClaimProps) => {
    if (!nearAddress || !nearConnected) {
      const error = new Error("Wallet not connected")
      onError?.(error)
      return
    }

    try {
      const isRegistered = await checkTokenRegistrationCallback()
      if (!isRegistered) {
        await registerTokenCallback(MEME_TOKEN_ADDRESS)
      }

      const claimTransaction = await signAndSendTransaction(CONTRACTID!, [
        {
          type: "FunctionCall",
          params: {
            methodName: "claimWheel",
            args: {
              rewardAmount: rewardAmount,
              tokenAddress: MEME_TOKEN_ADDRESS!,
            },
            gas: "300000000000000", // 300 TGas - should work with optimizations
            deposit: "0",
          },
        },
      ])

      await claimTransaction


      const executeTransferTx = await signAndSendTransaction(CONTRACTID!, [
        {
          type: "FunctionCall",
          params: {
            methodName: "execute_transfer",
            args: {},
            gas: "300000000000000",
            deposit: "0",
          },
        },
      ])

      await executeTransferTx

      localStorage.setItem("lastClaimed", Date.now().toString())
      localStorage.setItem("transaction", JSON.stringify({ claimTransaction, executeTransferTx }))
      onSuccess?.()
      return { claimTransaction, executeTransferTx }

    } catch (error: any) {
      console.error("Failed to claim reward:", error.message)
      onError?.(error as Error)
      throw error
    }
  }

  const handleSpinClick = () => {
    const now = Date.now()

    if (!nearConnected) {
      toast.error("Please connect your NEAR wallet to continue!")
      return
    }

    claimPoints("spin claim", setCanClaim)
    const newPrizeNumber = Math.floor(Math.random() * data.length)
    setPrizeNumber(newPrizeNumber)
    setMustSpin(true)
    spinningSound.play()
    setLastPlayed(now)
    setCooldownTime(new Date(now + 24 * 60 * 60 * 1000))
    localStorage.setItem("lastPlayedTime", now.toString())
  }

  const parseErrorMessage = (error: any): string => {
    try {
      if (typeof error === "string") {
        return error
      }

      if (error.message) {
        try {
          const parsed = JSON.parse(error.message)
          if (parsed.kind?.kind?.FunctionCallError?.ExecutionError) {
            const fullError = parsed.kind.kind.FunctionCallError.ExecutionError
            const match = fullError.match(/Smart contract panicked: (.*?)(?:\n|$)/)
            return match ? match[1] : fullError
          }
        } catch {
          return error.message
        }
      }

      return "Unknown error occurred"
    } catch {
      return "Failed to parse error message"
    }
  }

  const handleClaim = async () => {
    if (!winner) return
    setIsClaimLoading(true)
    try {
      await handleClaimRewardImproved({
        rewardAmount: data[prizeNumber].option,
        onSuccess: () => {
          setIsClaimed(true)

          localStorage.setItem("lastClaimed", Date.now().toString())
          localStorage.removeItem("unclaimedPrize")
          setIsClaimLoading(false)
          setUnclaimed(null)
        },
        onError: (error) => {
          console.error("Claim failed:", error)
          setIsClaimLoading(false)
          toast.error(`Failed to claim: ${parseErrorMessage(error)}`)
          alert(`Failed to claim:${parseErrorMessage(error)} `)
        },
      })
    } catch (error) {
      setIsClaimLoading(false)
      console.error("Claim failed:", error)
    }
  }

  return (
    <div
      className="max-h-screen w-full py-2 px-4 pb-24 relative overflow-hidden"
      style={{
        backgroundImage: "url('/tropical-adventure-bg.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        height: "calc(100vh - 80px)",
      }}
    >
      <div className="absolute inset-0 bg-blue-900/20"></div>

      <div className="relative z-10 max-w-xl mx-auto h-full flex flex-col">
        {/* <StatusBar3D className="mb-4" /> */}

        <div className="bg-white-600/30 backdrop-blur-sm rounded-3xl p-3 shadow-xl border border-blue-400/20 flex-1 flex flex-col min-h-1">
          <h2
            className="text-4xl font-black text-center text-white mb-2 drop-shadow-2xl"
            style={{ fontFamily: 'Impact, "Arial Black", sans-serif', letterSpacing: "2px" }}
          >
            SPIN THE WHEEL
          </h2>
          <p
            className="mb-4 text-xl text-center font-black drop-shadow-2xl text-white"
            style={{ fontFamily: 'Impact, "Arial Black", sans-serif', letterSpacing: "1px" }}
          >
            <span className="text-blue-300">SPINS LEFT: </span>
            <span className="text-3xl font-black text-yellow-300 drop-shadow-2xl">
              {new Date(cooldownTime) > new Date(Date.now()) ? user?.dailySpinCount : 2}
            </span>
          </p>

          <div className="relative flex justify-center mb-2 flex-1 items-center min-h-0">
            <div className="relative flex items-center justify-center">
              <div className="relative w-64 h-64 flex items-center justify-center">
                <img
                  src="/casino-wheel-3d.png"
                  alt="Casino Wheel"
                  className={`w-full h-full object-contain transition-transform duration-[3000ms] ease-out ${
                    mustSpin ? "animate-spin-wheel" : ""
                  }`}
                  style={{
                    transform: mustSpin ? `rotate(${prizeNumber * 40 + 1800}deg)` : "rotate(0deg)",
                  }}
                />

                <div className="absolute top-2 left-1/2 transform -translate-x-1/2 z-20">
                  <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-b-[20px] border-l-transparent border-r-transparent border-b-yellow-400 drop-shadow-lg"></div>
                  <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-b-[14px] border-l-transparent border-r-transparent border-b-white absolute top-1 left-1/2 transform -translate-x-1/2"></div>
                </div>

                <div className="absolute -inset-[50px] bg-gradient-radial from-yellow-400/40 via-orange-400/20 to-transparent blur-2xl animate-pulse pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {hasPlayed && new Date(cooldownTime) > new Date(Date.now()) ? (
              <CountdownTimer targetTime={cooldownTime} />
            ) : (
              <button
                onClick={handleSpinClick}
                disabled={(hasPlayed && new Date(cooldownTime) > new Date(Date.now())) || mustSpin}
                className="w-full py-3 bg-gradient-to-r from-orange-500 via-red-500 to-orange-600 text-white text-lg font-black rounded-2xl
                     hover:from-orange-600 hover:via-red-600 hover:to-orange-700 transition-all duration-300 transform hover:scale-105
                     disabled:opacity-50 disabled:cursor-not-allowed
                     shadow-2xl border-2 border-yellow-400"
              >
                <span className="drop-shadow-lg">🎯 SPIN NOW! 🎯</span>
              </button>
            )}

            {isClaimed && (
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-6 text-center">
                <div className="text-2xl text-white font-black drop-shadow-lg">🎉 REWARD CLAIMED SUCCESSFULLY! 🎉</div>
              </div>
            )}

            {(user?.dailySpinCount ?? 0) <= 0 && new Date(cooldownTime) > new Date(Date.now()) && (
              <button
                onClick={() => setBuySpins(true)}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-lg font-black rounded-2xl
                         hover:from-purple-700 hover:to-blue-700 transition-all duration-300 transform hover:scale-105
                         shadow-xl border-2 border-purple-400"
              >
                <span className="drop-shadow-lg">💎 BUY SPIN 💎</span>
              </button>
            )}
            {buySpins && <BuySpin setBuySpins={setBuySpins} />}
          </div>
        </div>
      </div>

      <WinPopup
        isVisible={(winner || unclaimed) && !isClaimed}
        prize={winner}
        onClaim={handleClaim}
        isClaimLoading={isClaimLoading}
      />

      <ToastContainer
        position="bottom-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick={false}
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
        transition={Bounce}
      />
    </div>
  )
}

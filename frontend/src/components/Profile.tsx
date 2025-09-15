"use client"

import { useEffect, useState } from "react"
import { Copy } from "lucide-react"
import type WebApp from "@twa-dev/sdk"
import axios from "axios"
import { FaFacebook, FaXTwitter, FaTelegram, FaYoutube } from "react-icons/fa6"
import TimerCountdown from "./Timer"
import { Wallet } from "lucide-react"
import { useAuth } from "@/app/contexts/AuthContext"
import { useToast } from "@/app/hooks/use-toast"
import DepositMultiplier from "./DepositMultiplier"
import StatusBar3D from "./StatusBar3D"
import Image from "next/image"

const UserProfile = ({ tg }: { tg: typeof WebApp | null }) => {
  const { user: userDetails, logout } = useAuth()
  return (
    <div
      className="max-h-screen w-full py-3 px-3 md:py-4 pb-5 relative overflow-hidden"
      style={{
        backgroundImage: "url('/tropical-adventure-bg.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="absolute inset-0 bg-none-transparent  pointer-events-none"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(34,211,238,0.1),transparent_50%)] pointer-events-none"></div>
      <button
        onClick={() => logout()}
        className="absolute top-6 right-6 z-50 w-12 h-12 bg-cover bg-center bg-no-repeat hover:scale-110 transition-all duration-200 shadow-lg"
        style={{
          backgroundImage: "url('/assets/buttons/power-button.png')",
        }}
        title="Logout"
      ></button>

      <div className="max-w-2xl mx-auto space-y-4 relative z-10">
      {/* <StatusBar3D className="mb-6" /> */}
        <div className="flex justify-end">
          {/* <UnifiedWalletConnector /> */}
          {/* <WalletMultiButton /> */}
        </div>

        {/* Profile Header */}
        <div className="bg-none  border-0">
          <ProfileHeader userDetails={userDetails} />
        </div>

        {/* Invite Link */}
        <div className="bg-none border-0">
          <Link userDetails={userDetails} />
        </div>

        {/* Farming Section */}
        <div className="mt-20 bg-none">
          <Farming />
        </div>

        {/* Tasks Section */}
        {/* <div className="mt-20 bg-none">
          <Tasks tg={tg} />
        </div> */}
      </div>
    </div>
  )
}

const ProfileHeader = ({ userDetails }: any) => {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <div className="relative mb-4">
        <Image
  src="/crown.png"
  alt="Crown"
  width={80}
  height={80}
  className="w-20 h-20 mx-auto drop-shadow-2xl hover:scale-110 transition-transform duration-500 filter"
/>
          <div className="absolute inset-0 bg-gradient-to-r from-brown-400/30 to-green-500/30 rounded-full blur-xl animate-pulse"></div>
        </div>

        {/* <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-full blur-xl opacity-50 scale-110"></div> */}
<div className="relative bg-gradient-to-br from-yellow-400 to-yellow-600 p-1 rounded-full shadow-2xl transform hover:scale-105 transition-transform duration-300">
  <div className="bg-white rounded-full w-16 h-16 flex items-center justify-center text-xl font-black text-yellow-600 shadow-inner">

            {userDetails?.username?.slice(0, 2).toUpperCase()}
          </div>
        </div>
      </div>

      <div className="text-center">
        <h2 className="text-xl font-black text-cyan-100 mb-4 tracking-wide drop-shadow-lg">{userDetails?.username}</h2>
        <div className="grid grid-cols-3 gap-6 w-full max-w-md">
          <div className="relative group flex flex-col items-center">
            <div className="relative">
            <Image
  src="/assets/profile/coins.webp"
  alt="Points"
  width={80}
  height={80}
  className="w-20 h-20 mx-auto drop-shadow-2xl group-hover:scale-110 transition-transform duration-300 filter brightness-110"
/>
<div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-2">
  <div className="px-3 py-1 rounded-full text-sm font-black shadow-lg border-2 border-amber-300 !text-white bg-black/40">
    {userDetails?.totalPoints || 0}
  </div>
</div>

            </div>
            <p className="text-xs font-bold text-cyan-100 uppercase tracking-wider mt-2">Points</p>
          </div>

          <div className="relative group flex flex-col items-center">
            <div className="relative">
            <Image
  src="/assets/profile/referral.webp"
  alt="Referrals"
  width={80}
  height={80}
  className="w-20 h-20 mx-auto drop-shadow-2xl group-hover:scale-110 transition-transform duration-300 filter brightness-110"
/>
<div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-2">
  <div className="px-3 py-1 rounded-full text-sm font-black shadow-lg border-2 border-blue-300 !text-white bg-black/40">
    {userDetails?.referralCount || 0}
  </div>
</div>

            </div>
            <p className="text-xs font-bold text-cyan-100 uppercase tracking-wider mt-2">Refs</p>
          </div>

          <div className="relative group flex flex-col items-center">
            <div className="relative">
            <Image
  src="/assets/profile/boost.webp"
  alt="Multiplier"
  width={80}
  height={80}
  className="w-20 h-20 mx-auto drop-shadow-2xl group-hover:scale-110 transition-transform duration-300 filter brightness-110"
/>
<div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-2">
  <div className="px-3 py-1 rounded-full text-sm font-black shadow-lg border-2 border-purple-300 !text-white bg-black/40">
    {userDetails?.multiplier || 0}
  </div>
</div>

            </div>
            <p className="text-xs font-bold text-cyan-100 uppercase tracking-wider mt-2">Boost</p>
          </div>
        </div>
      </div>
    </div>
  )
}

const Link = ({ userDetails }: any) => {
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
    <div className="mt-10 space-y-4">
    <div className="flex items-center justify-center gap-3">
      <h2 className="text-lg font-black text-cyan-100 uppercase tracking-wider">Invite Link</h2>
    </div>
    <div className="bg-none">
    <button
  onClick={handleCopy}
  className="relative w-30 mb-10 mx-auto px-6 py-4 text-amber-900 rounded-2xl transition-all flex items-center justify-center gap-2 text-sm font-black uppercase tracking-wider transform hover:scale-105 hover:-translate-y-1 hover:rotate-1 disabled:opacity-50 disabled:transform-none active:scale-95 active:translate-y-0"
  style={{
    backgroundImage: "url('/assets/buttons/wooden-button.png')",
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    boxShadow: "none", // removed shadow completely
  }}
>
  <span>{copyState}</span>
  <Copy className="w-4 h-4" />
</button>

    </div>
  </div>
  )
}

const Farming = () => {
  const { user: userDetails, refreshUser } = useAuth()
  const { toast } = useToast()

  const [loadingFarm, setLoadingFarm] = useState(false)
  const [amount, setAmount] = useState(0)
  const [count, setCount] = useState(0)

  const hashRate = 0.0035
  const remainingTime = new Date(userDetails?.lastClaim || new Date()).getTime() - new Date().getTime()

  const claimPoints = async (type: string, setLoading: (loading: boolean) => void) => {
    setLoading(true)
    try {
      const response = await fetch("/api/claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: userDetails?.username,
          type: type,
          userMultipler: userDetails?.multiplier || 1,
          solWallet: userDetails?.wallet || "",
        }),
      })

      const result = await response.json()

      if (response.ok && (result.username || result.success)) {
        await refreshUser()
        toast({
          title: "Claim Successful!",
          description: "Your points have been updated.",
          variant: "default",
        })
      } else {
        console.error("Claim failed:", result.error || result)
        const errorMessage = result.error || result.message || "Claim failed. Please try again."
        toast({
          title: "Claim Error",
          description: errorMessage,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error claiming points:", error)
      toast({
        title: "Network Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to connect to server. Please check your connection and try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setAmount(hashRate * (userDetails?.multiplier == 0 ? 1 : userDetails?.multiplier || 1) * (18000 - count / 1000))
  }, [count, userDetails?.multiplier])

  return (
    <div className="mt-10 space-y-4">
      <div className="flex items-center justify-center gap-3">
        {/* <img src="/axe.png" alt="Treasure Chest" className="w-12 h-12 drop-shadow-lg" /> */}
        <h2 className="text-lg font-black text-cyan-100 uppercase tracking-wider">Farming</h2>
      </div>
      <div className="flex justify-center">
      <button
  disabled={remainingTime > 0 && userDetails?.isMining}
  className="relative px-6 py-4 text-amber-900 rounded-xl transition-all text-sm font-black uppercase tracking-wider transform hover:scale-105 hover:-translate-y-1 hover:rotate-1 disabled:opacity-50 disabled:transform-none  active:scale-95 active:translate-y-0"
  style={{
    backgroundImage: "url('/assets/buttons/wooden-button.png')",
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    opacity: remainingTime > 0 && userDetails?.isMining ? 0.6 : 1,
    boxShadow: "none", // removed shadow completely
  }}
  onClick={async () => {
    setLoadingFarm(true);
    if (userDetails?.isMining) {
      if (remainingTime <= 0) claimPoints("farm claim--" + Math.round(amount), setLoadingFarm);
      return;
    }
    claimPoints("start farming", setLoadingFarm);
  }}
>
  {loadingFarm ? (
    <div className="flex items-center gap-1">
      <div className="w-3 h-3 border-t-2 border-amber-900 animate-spin rounded-full"></div>
      <span>Processing...</span>
    </div>
  ) : userDetails?.isMining ? (
    <>
      {remainingTime > 0 ? (
        <div className="flex items-center gap-2">
          <span>{`Mining ${amount > 1 ? amount.toFixed(2) : amount.toFixed(4)} SOLV`}</span>
          <TimerCountdown
            setCount={setCount}
            time={new Date(userDetails?.lastClaim || new Date()).getTime()}
          />
        </div>
      ) : (
        <span>Claim {amount.toFixed(2)} SOLV</span>
      )}
    </>
  ) : (
    <span>Start Mining</span>
  )}
</button>

      </div>
    </div>
  )
}

const Tasks = ({ tg }: { tg: typeof WebApp | null }) => {
  const [loading, setLoading] = useState({ id: "", status: false })
  const [onGoing, setOnGoing] = useState(false)
  const [isOpenSolModal, setIsOpenSolModal] = useState(false)
  const [error, setError] = useState("")
  const [tasks, setTasks] = useState<any[]>([])
  const [userTasks, setUserTasks] = useState<any[]>([])
  const [isLoadingTasks, setIsLoadingTasks] = useState(true)

  const { user: userDetails, refreshUser } = useAuth()
  const { toast } = useToast()

  const fetchTasks = async () => {
    try {
      setIsLoadingTasks(true)
      const response = await fetch("/api/tasks")
      const data = await response.json()

      if (response.ok) {
        setTasks(data.tasks || [])
        setUserTasks(data.userTasks || [])
      } else {
        console.error("Failed to fetch tasks:", data.error)
        toast({
          title: "Error",
          description: "Failed to load tasks. Please try again.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error fetching tasks:", error)
      toast({
        title: "Network Error",
        description: "Failed to connect to server. Please check your connection.",
        variant: "destructive",
      })
    } finally {
      setIsLoadingTasks(false)
    }
  }

  useEffect(() => {
    fetchTasks()
  }, [])

  const refreshTasks = async () => {
    await fetchTasks()
  }

  const engageTasks = async (type: string, data: any, func: (param: boolean) => void) => {
    func(true)
    try {
      const response = await fetch("/api/allroute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: userDetails?.username,
          type: type,
          data: data,
          userMultipler: userDetails?.multiplier || 1,
        }),
      })

      const result = await response.json()

      if (response.ok && (result.weeklyScore || result.id || result.success)) {
        await refreshUser()
        await refreshTasks()
        toast({
          title: "Task Completed!",
          description: "Your points have been updated.",
          variant: "default",
        })
      } else {
        console.error("Task engagement failed:", result.error || result)
        const errorMessage = result.error || result.message || "Task engagement failed. Please try again."
        toast({
          title: "Task Error",
          description: errorMessage,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error engaging task:", error)
      toast({
        title: "Network Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to connect to server. Please check your connection and try again.",
        variant: "destructive",
      })
    } finally {
      func(false)
    }
  }

  const sendComplete = async (data: any) => {
    const taskData = {
      task: data,
      userId: userDetails?.id,
    }
    const res = await engageTasks("completetasks", taskData, () => setLoading({ id: data.id, status: false }))
  }

  const ProcessLink = async (data: any) => {
    setLoading({ id: data.id, status: true })

    const res = await engageTasks("reg4tasks", data, () => setLoading({ id: data.id, status: false }))

    if (!data?.link) return
    data.link && window?.open(data.link)
  }

  const Verify = async (data: any, type = "") => {
    setLoading({ id: data.id, status: true })
    setError("")

    if (data.name.includes("Join Solvium Telegram Group")) {
      try {
        const response = await axios.get(
          `https://api.telegram.org/bot7858122446:AAEwouIyKmFuF5vnxpY4FUNY6r4VIEMtWH0/getChatMember?chat_id=-1002478373737&user_id=${userDetails?.chatId}`,
        )

        if (response.data.result.user.username == userDetails?.username) {
          if (response.data.result.status == "member") {
            sendComplete(data)
            return
          } else {
            setError("You have not Joined Group yet!")
            toast({
              title: "Group Error",
              description: "You have not joined the Telegram group yet! Please join the group first.",
              variant: "destructive",
            })
            setLoading({ id: data.id, status: false })
            setTimeout(() => {
              data.link && tg?.openLink(data.link)
            }, 2000)
            return
          }
        } else {
          setError("An error occurred, Please try again!")
          toast({
            title: "Verification Error",
            description: "Verification failed. Please try again or contact support.",
            variant: "destructive",
          })
          setLoading({ id: data.id, status: false })
          return
        }
      } catch (error) {
        setError("An error occurred, Please try again!")
        toast({
          title: "Network Error",
          description: "Network error during verification. Please check your connection and try again.",
          variant: "destructive",
        })
        setLoading({ id: data.id, status: false })
        return
      }
    }

    if (data.name.includes("Join Solvium Chat")) {
      try {
        const response = await axios.get(
          `https://api.telegram.org/bot7858122446:AAEwouIyKmFuF5vnxpY4FUNY6r4VIEMtWH0/getChatMember?chat_id=-1002376352525&user_id=${userDetails?.chatId}`,
        )

        if (response.data.result.user.username == userDetails?.username) {
          if (response.data.result.status == "member") {
            sendComplete(data)
            return
          } else {
            setError("You have not Joined Group yet!")
            toast({
              title: "Group Error",
              description: "You have not joined the Telegram chat yet! Please join the chat first.",
              variant: "destructive",
            })
            setLoading({ id: data.id, status: false })
            setTimeout(() => {
              data.link && tg?.openLink(data.link)
            }, 2000)
            return
          }
        } else {
          setError("An error occurred, Please try again!")
          toast({
            title: "Verification Error",
            description: "Verification failed. Please try again or contact support.",
            variant: "destructive",
          })
          setLoading({ id: data.id, status: false })
          return
        }
      } catch (error) {
        setError("An error occurred, Please try again!")
        toast({
          title: "Network Error",
          description: "Network error during verification. Please check your connection and try again.",
          variant: "destructive",
        })
        setLoading({ id: data.id, status: false })
        return
      }
    }

    sendComplete(data)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-3">
        <Image src="/key.png" alt="Key" className="w-8 h-8 drop-shadow-lg" />
        <h2 className="text-lg font-black text-cyan-100 uppercase tracking-wider">Tasks</h2>
      </div>

      <div className="space-y-3">
        <div className="bg-gradient-to-br from-blue-700/50 to-cyan-800/50 rounded-2xl p-4 border-2 border-cyan-400/20 backdrop-blur-sm">
          <p className="text-lg font-bold text-cyan-100 mb-3 uppercase tracking-wider">Purchase Multiplier</p>
          <DepositMultiplier user={userDetails} />
        </div>
        {isLoadingTasks ? (
          <div className="flex justify-center items-center py-8">
            <div className="w-8 h-8 border-t-4 border-cyan-400 animate-spin rounded-full"></div>
            <span className="ml-3 text-cyan-100 text-lg font-bold">Loading tasks...</span>
          </div>
        ) : tasks?.length === 0 ? (
          <div className="text-center text-cyan-100 text-lg font-bold py-6">No tasks available.</div>
        ) : (
          <div className="space-y-3">
            {tasks?.map((task: any, i: number) => {
              let curCat = "Tg"
              let icon = <FaTelegram className="text-tropical-blue text-xl" />

              switch (task.name.toLowerCase()) {
                case "follow x".toLowerCase():
                  icon = <FaXTwitter className="text-tropical-blue text-xl" />
                  curCat = "x"
                  break
                case "follow facebook".toLowerCase():
                case "join facebook group".toLowerCase():
                  curCat = "fb"
                  icon = <FaFacebook className="text-tropical-blue text-xl" />
                  break
                case "subscribe to youtube".toLowerCase():
                  curCat = "yt"
                  icon = <FaYoutube className="text-tropical-blue text-xl" />
                  break
                case "connect wallet".toLowerCase():
                  curCat = "wallet"
                  icon = <Wallet className="text-tropical-blue text-xl" />
                  break
                default:
                  break
              }

              let found = false
              let onGoing = false

              userTasks?.length > 0 &&
                userTasks?.map((utask: any) => {
                  if (task.id == utask.taskId) {
                    if (utask.isCompleted) found = true
                    onGoing = true
                  }
                })

              if (found) return <div key={i + task.name + "task" + i}> </div>
              if (task.points == 0) return <div key={task.name + task.id + "task" + i}> </div>

              return (
                <div
                  key={"bbb" + task.name + "task" + i}
                  className="bg-gradient-to-br from-blue-700/50 to-cyan-800/50 rounded-2xl p-4 border-2 border-cyan-400/20 backdrop-blur-sm hover:border-cyan-300/60 transition-all duration-300 hover:shadow-xl hover:shadow-cyan-500/10 transform hover:scale-102"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-400/20 to-blue-500/20 border-2 border-cyan-400/30 flex items-center justify-center transform hover:scale-110 transition-transform duration-300"
                      style={{
                        boxShadow:
                          "0 6px 15px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.2)",
                      }}
                    >
                      <div className="text-lg">{icon}</div>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-cyan-100 mb-1">{task.name}</p>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-5 h-5 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg flex items-center justify-center"
                          style={{
                            boxShadow: "0 4px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.3)",
                          }}
                        >
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                        <p className="text-sm font-black text-yellow-300">{task.points} SOLV</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setLoading({ id: task.id, status: true })
                        onGoing ? Verify(task) : ProcessLink(task)
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-xl transition-all font-black uppercase tracking-wider disabled:opacity-50 transform hover:scale-105 hover:-translate-y-1 hover:rotate-1 border-2 border-cyan-300/30 text-xs active:scale-95 active:translate-y-0"
                      style={{
                        boxShadow:
                          "0 8px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -2px 0 rgba(0,0,0,0.2)",
                      }}
                      disabled={loading.id == task.id && loading.status}
                    >
                      {loading.id == task.id && loading.status ? (
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 border-t-2 border-white animate-spin rounded-full"></div>
                          <span>Loading</span>
                        </div>
                      ) : (
                        <span>{onGoing ? "Verify" : "Start"}</span>
                      )}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

const Modal = () => {
  return (
    <div>
      <dialog id="my_modal_3" className="modal">
        <div className="modal-box ">
          <form method="dialog">
            <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
          </form>
          <div className="p-5">
            <p>Support the project and double your points over the next week</p>

            <div>
              <p>Amount</p>
              <input type="text" />
            </div>
            <div>
              <button>Support</button>
            </div>
          </div>
        </div>
      </dialog>
    </div>
  )
}

export default UserProfile

"use client"

import { useEffect, useState } from "react"
import type WebApp from "@twa-dev/sdk"
import axios from "axios"
import { FaXTwitter, FaTelegram } from "react-icons/fa6"
import { Gamepad2, Target, Trophy, Users, Star, ArrowLeft, Info } from "lucide-react"
import { useAuth } from "@/app/contexts/AuthContext"
import { useToast } from "@/app/hooks/use-toast"

const Tasks = ({ tg }: { tg: typeof WebApp | null }) => {
  const [loading, setLoading] = useState({ id: "", status: false })
  const [onGoing, setOnGoing] = useState(false)
  const [error, setError] = useState("")
  const [tasks, setTasks] = useState<any[]>([])
  const [userTasks, setUserTasks] = useState<any[]>([])
  const [isLoadingTasks, setIsLoadingTasks] = useState(true)
  const [nearAmount, setNearAmount] = useState("")
  const [depositLoading, setDepositLoading] = useState(false)

  const { user: userDetails, refreshUser } = useAuth()
  const { toast } = useToast()

  const gamingTasks = [
    {
      id: "daily-login",
      name: "Daily Login Streak",
      description: "Login 7 days in a row for bonus rewards",
      points: 200,
      icon: <Gamepad2 className="w-6 h-6" />,
      progress: 3,
      maxProgress: 7,
      category: "gaming",
    },
    {
      id: "first-game",
      name: "Play Your First Game",
      description: "Complete a game session to unlock achievements",
      points: 300,
      icon: <Target className="w-6 h-6" />,
      category: "gaming",
    },
    {
      id: "weekly-champion",
      name: "Weekly Champion",
      description: "Reach top 10 on weekly leaderboard",
      points: 1000,
      icon: <Trophy className="w-6 h-6" />,
      category: "special",
    },
  ]

  const multiplierTiers = [
    { amount: 1, multiplier: 1.5 },
    { amount: 5, multiplier: 2 },
    { amount: 10, multiplier: 3 },
    { amount: 25, multiplier: 5 },
  ]

  const fetchTasks = async () => {
    try {
      setIsLoadingTasks(true)
      const response = await fetch("/api/tasks")

      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        console.error("Server returned non-JSON response:", response.status, response.statusText)
        setTasks([
          {
            id: 1,
            name: "Follow X",
            points: 100,
            link: "https://x.com/solvium",
            category: "social",
          },
          {
            id: 2,
            name: "Join Telegram Channel",
            points: 150,
            link: "https://t.me/solviumgame",
            category: "social",
          },
          {
            id: 3,
            name: "Invite 5 Friends",
            points: 500,
            category: "social",
          },
        ])
        setUserTasks([])
        return
      }

      const data = await response.json()

      if (response.ok) {
        setTasks(data.tasks || [])
        setUserTasks(data.userTasks || [])
      } else {
        console.error("Failed to fetch tasks:", data.error)
      }
    } catch (error) {
      console.error("Error fetching tasks:", error)
      setTasks([
        {
          id: 1,
          name: "Follow X",
          points: 100,
          link: "https://x.com/solvium",
          category: "social",
        },
        {
          id: 2,
          name: "Join Telegram Channel",
          points: 150,
          link: "https://t.me/solviumgame",
          category: "social",
        },
        {
          id: 3,
          name: "Invite 5 Friends",
          points: 500,
          category: "social",
        },
      ])
      setUserTasks([])
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
    await engageTasks("completetasks", taskData, () => setLoading({ id: data.id, status: false }))
  }

  const ProcessLink = async (data: any) => {
    setLoading({ id: data.id, status: true })
    await engageTasks("reg4tasks", data, () => setLoading({ id: data.id, status: false }))
    if (!data?.link) return
    data.link && window?.open(data.link)
  }

  const Verify = async (data: any) => {
    setLoading({ id: data.id, status: true })
    setError("")

    if (data.name.includes("Join Solvium Telegram Group") || data.name.includes("Join Telegram Channel")) {
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

    sendComplete(data)
  }

  const handleDeposit = async () => {
    if (!nearAmount || Number.parseFloat(nearAmount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid NEAR amount",
        variant: "destructive",
      })
      return
    }

    setDepositLoading(true)
    // Simulate deposit logic
    setTimeout(() => {
      toast({
        title: "Deposit Successful",
        description: `Deposited ${nearAmount} NEAR`,
        variant: "default",
      })
      setDepositLoading(false)
      setNearAmount("")
    }, 2000)
  }

  const getTaskIcon = (taskName: string) => {
    if (taskName.toLowerCase().includes("x") || taskName.toLowerCase().includes("twitter")) {
      return <FaXTwitter className="w-6 h-6" />
    }
    if (taskName.toLowerCase().includes("telegram")) {
      return <FaTelegram className="w-6 h-6" />
    }
    if (taskName.toLowerCase().includes("invite") || taskName.toLowerCase().includes("friend")) {
      return <Users className="w-6 h-6" />
    }
    return <Star className="w-6 h-6" />
  }

  return (
    <div className="min-h-screen bg-[#0A0A1F] text-white pb-20">
      <div className="px-4 pt-6 pb-4">
        <button className="flex items-center gap-2 text-white mb-4">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Back</span>
        </button>
        <h1
          className="text-3xl font-bold text-center mb-2 tracking-wider"
          style={{
            fontFamily: "'Press Start 2P', monospace",
            textShadow: "2px 2px 0px rgba(0,0,0,0.5)",
          }}
        >
          TASK CENTER
        </h1>
        <p className="text-center text-sm text-gray-400">Complete tasks to earn SOLV points and unlock multipliers</p>
      </div>

      <div className="px-4 mb-6">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gradient-to-br from-pink-500 to-purple-600 rounded-2xl p-4 text-center">
          <div className="text-2xl font-bold">
  {("weeklyScore" in (userDetails ?? {})) 
    ? (userDetails as any).weeklyScore 
    : 1250}
</div>

            <div className="text-xs text-white/80 mt-1">SOLV Points</div>
          </div>
          <div className="bg-[#1a1a3e] border-2 border-blue-500/30 rounded-2xl p-4 text-center">
            <div className="text-2xl font-bold">0.00</div>
            <div className="text-xs text-gray-400 mt-1">NEAR</div>
          </div>
          <div className="bg-[#1a1a3e] border-2 border-purple-500/30 rounded-2xl p-4 text-center">
            <div className="text-2xl font-bold">{userDetails?.multiplier || 1}x</div>
            <div className="text-xs text-gray-400 mt-1">Multiplier</div>
          </div>
        </div>
      </div>

      <div className="px-4 mb-6">
        <div className="bg-[#1a1a3e] border-2 border-blue-500/30 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center">
                <span className="text-lg">💰</span>
              </div>
              <h3 className="text-lg font-bold">Deposit NEAR for Multipliers</h3>
            </div>
            <Info className="w-5 h-5 text-gray-400" />
          </div>

          <div className="flex gap-2 mb-4">
            <input
              type="number"
              placeholder="Enter NEAR amount"
              value={nearAmount}
              onChange={(e) => setNearAmount(e.target.value)}
              className="flex-1 bg-[#0f0f2a] border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-pink-500"
            />
            <button
              onClick={handleDeposit}
              disabled={depositLoading}
              className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 px-6 py-3 rounded-xl font-bold transition-all disabled:opacity-50"
            >
              {depositLoading ? "..." : "Deposit"}
            </button>
          </div>

          <div className="mb-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 bg-gradient-to-br from-blue-400 to-cyan-500 rounded flex items-center justify-center text-xs">
                ⚡
              </div>
              <span className="text-sm font-medium text-gray-300">Multiplier Tiers</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {multiplierTiers.map((tier) => (
                <button
                  key={tier.amount}
                  onClick={() => setNearAmount(tier.amount.toString())}
                  className="bg-[#0f0f2a] hover:bg-[#1a1a3e] border border-gray-700 hover:border-blue-500/50 rounded-xl px-3 py-2 text-sm font-medium transition-all flex items-center justify-between"
                >
                  <span>{tier.amount} NEAR</span>
                  <span className="bg-gradient-to-r from-blue-400 to-cyan-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                    +{tier.multiplier}x
                  </span>
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs text-gray-400 text-center">
            Higher deposits unlock better point multipliers for all tasks
          </p>
        </div>
      </div>

      <div className="px-4 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Star className="w-5 h-5 text-yellow-400" />
          <h2 className="text-xl font-bold">Gaming Tasks</h2>
        </div>

        <div className="space-y-3">
          {gamingTasks.map((task) => (
            <div
              key={task.id}
              className={`rounded-2xl p-5 border-2 ${
                task.category === "special"
                  ? "bg-gradient-to-br from-pink-500 to-purple-600 border-pink-400/30"
                  : "bg-gradient-to-br from-blue-600/40 to-blue-800/40 border-blue-500/30"
              }`}
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  {task.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-1">
                    <h3 className="text-base font-bold">{task.name}</h3>
                    <span className="bg-gradient-to-r from-orange-400 to-orange-600 text-white text-xs px-3 py-1 rounded-full font-bold whitespace-nowrap ml-2">
                      +{task.points} SOLV
                    </span>
                  </div>
                  <p className="text-sm text-white/70">{task.description}</p>
                </div>
              </div>

              {task.progress !== undefined && (
                <div className="mb-4">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="text-white/70">Progress</span>
                    <span className="font-bold">
                      {task.progress}/{task.maxProgress}
                    </span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-cyan-400 to-blue-500 h-full rounded-full transition-all"
                      style={{ width: `${(task.progress / task.maxProgress) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              <button
                className={`w-full py-3 rounded-xl font-bold transition-all ${
                  task.category === "special"
                    ? "bg-white text-purple-600 hover:bg-gray-100"
                    : "bg-[#0A0A1F] text-white hover:bg-black"
                }`}
              >
                Start Task
              </button>
            </div>
          ))}
        </div>

        <p className="text-xs text-center text-gray-400 mt-4">
          Earn more with higher NEAR deposits • Multipliers apply to all SOLV rewards
        </p>
      </div>

      <div className="px-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-5 h-5 bg-white/10 rounded flex items-center justify-center">
            <span className="text-sm">🔗</span>
          </div>
          <h2 className="text-xl font-bold">Social Media Tasks</h2>
        </div>

        {isLoadingTasks ? (
          <div className="flex justify-center items-center py-8">
            <div className="w-8 h-8 border-t-4 border-pink-500 animate-spin rounded-full"></div>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks?.map((task: any) => {
              let found = false
              let onGoing = false

              userTasks?.forEach((utask: any) => {
                if (task.id == utask.taskId) {
                  if (utask.isCompleted) found = true
                  onGoing = true
                }
              })

              if (found || task.points == 0) return null

              return (
                <div
                  key={task.id}
                  className="bg-gradient-to-br from-blue-600/40 to-blue-800/40 border-2 border-blue-500/30 rounded-2xl p-5"
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                      {getTaskIcon(task.name)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-1">
                        <h3 className="text-base font-bold">{task.name}</h3>
                        <span className="bg-gradient-to-r from-orange-400 to-orange-600 text-white text-xs px-3 py-1 rounded-full font-bold whitespace-nowrap ml-2">
                          +{task.points} SOLV
                        </span>
                      </div>
                      <p className="text-sm text-white/70">
                        {task.name.includes("X")
                          ? "Follow our official Twitter account for updates"
                          : task.name.includes("Telegram")
                            ? "Join our community channel for exclusive content"
                            : "Invite friends and earn rewards for each signup"}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setLoading({ id: task.id, status: true })
                      onGoing ? Verify(task) : ProcessLink(task)
                    }}
                    disabled={loading.id == task.id && loading.status}
                    className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 py-3 rounded-xl font-bold transition-all disabled:opacity-50"
                  >
                    {loading.id == task.id && loading.status ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-t-2 border-white animate-spin rounded-full"></div>
                        <span>Loading...</span>
                      </div>
                    ) : (
                      <span>{onGoing ? "Verify" : "Start Task"}</span>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default Tasks

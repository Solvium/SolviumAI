"use client"
import type WebApp from "@twa-dev/sdk"
import Tasks from "./Tasks"

const TasksPage = ({ tg }: { tg: typeof WebApp | null }) => {
  return (
    <div
      className="max-h-screen w-full py-3 px-3 md:py-4 relative overflow-hidden"
      style={{
        backgroundImage: "url('/tropical-adventure-bg.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="absolute inset-0 bg-none-transparent pointer-events-none"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(34,211,238,0.1),transparent_50%)] pointer-events-none"></div>

      <div className="max-w-2xl mx-auto space-y-4 relative z-10">
        <div className="mt-20 bg-none">
          <Tasks tg={tg} />
        </div>
      </div>
    </div>
  )
}

export default TasksPage

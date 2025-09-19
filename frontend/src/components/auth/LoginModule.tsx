"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useAuth } from "@/app/contexts/AuthContext"
import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google"
import { GOOGLE_CLIENT_ID } from "@/app/config/google"
import { FaTelegram, FaSpinner } from "react-icons/fa"
import { toast } from "react-toastify"
import Image from "next/image"

interface LoginModuleProps {
  onLoginSuccess?: () => void
  onLoginError?: (error: Error) => void
}

export const LoginModule: React.FC<LoginModuleProps> = ({ onLoginSuccess, onLoginError }) => {
  const { loginWithTelegram, loginWithGoogle, isLoading, error } = useAuth()
  const [isTelegramAvailable, setIsTelegramAvailable] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isClient, setIsClient] = useState(false)

  // Ensure we're on the client side
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Check if Telegram Web App is available
  useEffect(() => {
    if (!isClient) return

    const checkTelegramAvailability = async () => {
      try {
        // Dynamically import WebApp to avoid SSR issues
        const { default: WebApp } = await import("@twa-dev/sdk")

        // Check multiple ways to detect Telegram WebApp
        const tg = (window as any)?.Telegram?.WebApp
        const webApp = WebApp


        // Check if we're in Telegram WebApp context
        if (webApp && webApp.platform !== "unknown") {
          setIsTelegramAvailable(true);
          return;
        }

        // Fallback check for window.Telegram
        if (tg && tg.platform !== "unknown") {
          setIsTelegramAvailable(true);
          return;
        }

        // Additional check for user data
        if (webApp?.initDataUnsafe?.user || tg?.initDataUnsafe?.user) {
          setIsTelegramAvailable(true);
          return;
        }
        setIsTelegramAvailable(false);
      } catch (error) {
        console.error("Error checking Telegram availability:", error)
        setIsTelegramAvailable(false)
      }
    }

    // Check immediately
    checkTelegramAvailability()

    // Check periodically for the first 5 seconds
    let attempts = 0
    const interval = setInterval(() => {
      attempts++
      checkTelegramAvailability()

      if (attempts >= 5) {
        clearInterval(interval)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [isClient])

  const handleTelegramLogin = async () => {
    if (!isTelegramAvailable || !isClient) {
      toast.error("Telegram Web App is not available")
      return
    }

    setIsProcessing(true)
    try {
      // Dynamically import WebApp to avoid SSR issues
      const { default: WebApp } = await import("@twa-dev/sdk")

      // Try to get user data from WebApp SDK
      const webApp = WebApp
      let userData = null

      if (webApp?.initDataUnsafe?.user) {
        userData = webApp.initDataUnsafe.user
      } else if ((window as any)?.Telegram?.WebApp?.initDataUnsafe?.user) {
        userData = (window as any).Telegram.WebApp.initDataUnsafe.user
      }

      if (!userData) {
        throw new Error("Telegram user data not available")
      }
      await loginWithTelegram({ telegramData: userData });
      toast.success("Successfully logged in with Telegram!");
      onLoginSuccess?.();
    } catch (error: any) {
      const message = error.message || "Telegram login failed"
      toast.error(message)
      onLoginError?.(error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleGoogleLogin = async (credential: string) => {
    setIsProcessing(true)
    try {
      await loginWithGoogle(credential)
      toast.success("Successfully logged in with Google!")
      onLoginSuccess?.()
    } catch (error: any) {
      const message = error.message || "Google login failed"
      toast.error(message)
      onLoginError?.(error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleGoogleError = () => {
    toast.error("Google login failed. Please try again.")
  }

  // Don't render until we're on the client side
  if (!isClient) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-500"></div>
      </div>
    )
  }

  return (

    <div className="min-h-screen relative overflow-hidden flex items-center justify-center bg-black">
    <Image
      src="/coming-soon.png" 
      alt="Coming Soon"
      width={800}
      height={800}
      className="object-contain"
      priority
    />
  </div>

    // <div className="min-h-screen relative overflow-hidden">
    //   {/* Background Image */}
    //   <div className="absolute inset-0 z-0">
    //     <Image
    //       src="/sonic-background.jpg"
    //       alt="Sonic Background"
    //       fill
    //       className="object-cover"
    //       priority
    //     />
    //   </div>

    //   {/* Content positioned in lower portion */}
    //   <div className="relative z-10 min-h-screen flex flex-col justify-end pb-10">
    //     {/* Main Logo Section - moved to bottom */}
    //     <div className="flex flex-col items-center justify-center px-8 text-center">
    //       {/* <div className="mb-6">
    //         <Image
    //           src="/solvium-logo.png"
    //           alt="Solvium Logo"
    //           width={100}
    //           height={100}
    //           className="mx-auto drop-shadow-2xl"
    //         />
    //       </div> */}

    //       {/* Large Game Logo */}
    //       <div className="mb-8">
    //         <h1 className="text-5xl md:text-6xl font-black text-white drop-shadow-2xl mb-2 tracking-wider">SOLVIUM</h1>
    //         <div className="h-2 w-24 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full mx-auto shadow-lg"></div>
    //       </div>

    //       {/* Login Buttons */}
    //       <div className="space-y-4 w-full max-w-sm">
    //         {/* Telegram Login */}
    //         {isTelegramAvailable && (
    //           <button
    //             onClick={handleTelegramLogin}
    //             disabled={isProcessing || isLoading}
    //             className="w-full flex items-center justify-center gap-3 bg-blue-500/90 hover:bg-blue-600/90 disabled:bg-blue-400/90 text-white font-bold py-3 px-6 rounded-full transition-all duration-200 transform hover:scale-105 shadow-2xl border-2 border-white/20 backdrop-blur-sm"
    //           >
    //             {isProcessing ? <FaSpinner className="animate-spin text-lg" /> : <FaTelegram className="text-lg" />}
    //             <span className="text-base">{isProcessing ? "Connecting..." : "Continue with Telegram"}</span>
    //           </button>
    //         )}

    //         {/* Google Login */}
    //         <div className="w-full">
    //           <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
    //             <div className="w-full bg-white/95 hover:bg-white rounded-full shadow-2xl border-2 border-white/30 transition-all duration-200 transform hover:scale-105 overflow-hidden backdrop-blur-sm">
    //               <GoogleLogin
    //                 onSuccess={(credentialResponse) => {
    //                   if (credentialResponse.credential) {
    //                     handleGoogleLogin(credentialResponse.credential)
    //                   }
    //                 }}
    //                 onError={handleGoogleError}
    //                 useOneTap={false}
    //                 theme="filled_blue"
    //                 size="large"
    //                 text="continue_with"
    //                 shape="pill"
    //                 locale="en"
    //               />
    //             </div>
    //           </GoogleOAuthProvider>
    //         </div>
    //       </div>
    //     </div>

    //     {/* Bottom Branding */}
    //     <div className="pt-6 text-center">
    //       <div className="flex items-center justify-center gap-4 text-white/80">
    //         <span className="text-sm font-bold tracking-wider drop-shadow-lg">SOLVIUM</span>
    //         <div className="w-1 h-1 bg-white/60 rounded-full"></div>
    //         <span className="text-sm font-medium drop-shadow-lg">v1.0</span>
    //       </div>
    //     </div>
    //   </div>

    //   {/* Error Display */}
    //   {error && (
    //     <div className="fixed top-8 left-1/2 transform -translate-x-1/2 z-50">
    //       <div className="bg-red-500 text-white px-6 py-3 rounded-full shadow-xl border-2 border-red-200">
    //         <p className="text-sm font-medium">{error}</p>
    //       </div>
    //     </div>
    //   )}

    //   {/* Loading Overlay */}
    //   {isLoading && (
    //     <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-50">
    //       <div className="bg-white/95 backdrop-blur-md p-8 rounded-full flex items-center gap-4 shadow-2xl border border-gray-200">
    //         <FaSpinner className="animate-spin text-blue-500 text-2xl" />
    //         <span className="text-gray-900 font-semibold text-lg">Loading...</span>
    //       </div>
    //     </div>
    //   )}

    //   {/* Debug info - remove in production */}
    //   {process.env.NODE_ENV === "development" && (
    //     <div className="fixed bottom-4 right-4 text-xs text-gray-500 bg-white/80 backdrop-blur-md px-3 py-2 rounded-lg border border-gray-200 shadow-lg">
    //       Telegram: {isTelegramAvailable ? "✓" : "✗"}
    //     </div>
    //   )}
    // </div>
  )
}

export default LoginModule



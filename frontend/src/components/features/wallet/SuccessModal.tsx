"use client"

import { X } from "lucide-react"

interface SuccessModalProps {
  onClose: () => void
}

const SuccessModal = ({ onClose }: SuccessModalProps) => {
  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-[#1a1f3a] rounded-3xl p-8 max-w-sm w-full relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-white/50 hover:text-white">
          <X className="w-6 h-6" />
        </button>

        <div className="text-center space-y-6">
          <h2 className="text-white text-2xl font-bold">Transaction Confirmed</h2>

          <div className="flex items-center justify-center">
            <div className="w-24 h-24 rounded-full border-4 border-[#0075EA] flex items-center justify-center">
              <svg className="w-12 h-12 text-[#0075EA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full py-4 bg-[#0075EA] text-white rounded-full text-lg font-medium hover:bg-cyan-600 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

export default SuccessModal

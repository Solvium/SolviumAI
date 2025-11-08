"use client";

import { usePrivateKeyWallet } from "@/contexts/PrivateKeyWalletContext";
import { BitteAiChat } from "@bitte-ai/chat";
import {
  X,
  Minus,
  ThumbsUp,
  ThumbsDown,
  Smile,
  Paperclip,
  Send,
} from "lucide-react";
import React from "react";

// Type definitions for custom components
interface MessageGroupComponentProps {
  message: any;
  isUser: boolean;
  userName: string;
  children: React.ReactNode;
  style: {
    backgroundColor: string;
    borderColor: string;
    textColor: string;
  };
  uniqueKey: string;
}

interface ChatContainerComponentProps {
  children: React.ReactNode;
  style?: {
    backgroundColor?: string;
    borderColor?: string;
  };
}

interface InputContainerProps {
  children: React.ReactNode;
  style?: {
    backgroundColor?: string;
    borderColor?: string;
  };
}

interface SendButtonComponentProps {
  input: string;
  isLoading: boolean;
  buttonColor?: string;
  textColor?: string;
  onClick?: () => void;
}

interface LoadingIndicatorComponentProps {
  textColor?: string;
}

interface AIChatAgentProps {
  isOpen: boolean;
  onClose: () => void;
}

// Custom Chat Container - wraps the messages area with proper sizing
const CustomChatContainer = ({
  children,
  style,
}: ChatContainerComponentProps) => {
  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-3 space-y-3 min-h-0">
      {children}
    </div>
  );
};

// Custom Message Container - matches the original message bubble style
const CustomMessageContainer = ({
  message,
  isUser,
  userName,
  children,
  style,
  uniqueKey,
}: MessageGroupComponentProps) => {
  const timestamp = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isUser) {
    return (
      <div className="flex flex-col items-end">
        <div className="text-[10px] text-gray-500 mb-0.5">
          Visitor {timestamp}
        </div>
        <div className="bg-blue-600 rounded-lg rounded-tr-none px-3 py-2 max-w-[80%]">
          <p className="text-xs text-white">{children}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-1.5">
      <div className="flex-shrink-0 w-5 h-5 bg-blue-600 rounded flex items-center justify-center">
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 2L2 7L12 12L22 7L12 2Z"
            fill="white"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className="flex-1">
        <div className="text-[10px] text-gray-500 mb-0.5">
          Livechat {timestamp}
        </div>
        <div className="bg-white rounded-lg rounded-tl-none px-3 py-2 shadow-sm">
          <p className="text-xs text-gray-700">{children}</p>
        </div>
      </div>
    </div>
  );
};

// Custom Input Container - matches the original input design
// Ensures input field and buttons are properly aligned inside the input area
const CustomInputContainer = ({ children }: InputContainerProps) => {
  return (
    <div className="bg-white border-t border-gray-200 p-3 flex-shrink-0">
      <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2.5 py-1.5 w-full">
        {/* Render all children - input field will flex-grow, buttons will align right via sendButtonComponent */}
        {children}
      </div>
      <div className="text-center text-[10px] text-gray-500 mt-1.5">
        Powered by <span className="font-semibold">Solvium Agent</span>
      </div>
    </div>
  );
};

// Custom Send Button - matches the original send button placement
// The buttons should be positioned inside the input field area, aligned to the right
const CustomSendButton = ({ onClick, isLoading }: SendButtonComponentProps) => {
  return (
    <>
      <button
        type="button"
        className="text-gray-400 hover:text-gray-600 p-1 flex-shrink-0"
        aria-label="Emoji"
      >
        <Smile className="w-4 h-4" />
      </button>
      <button
        type="button"
        className="text-gray-400 hover:text-gray-600 p-1 flex-shrink-0"
        aria-label="Attachment"
      >
        <Paperclip className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={onClick}
        disabled={isLoading}
        className="text-blue-600 hover:text-blue-700 disabled:opacity-50 p-1 flex-shrink-0"
        aria-label="Send"
      >
        <Send className="w-4 h-4" />
      </button>
    </>
  );
};

// Custom Loading Indicator
const CustomLoadingIndicator = ({
  textColor,
}: LoadingIndicatorComponentProps) => {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-shrink-0 w-5 h-5 bg-blue-600 rounded flex items-center justify-center">
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 2L2 7L12 12L22 7L12 2Z"
            fill="white"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className="bg-white rounded-lg rounded-tl-none px-3 py-2 shadow-sm">
        <p className="text-xs text-gray-700">Thinking...</p>
      </div>
    </div>
  );
};

// Custom Welcome Message Component - Agent Info section
const CustomWelcome = () => {
  return (
    <div className="bg-white border-b border-gray-200 px-3 py-2.5 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-2.5">
        <div className="relative">
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 2L2 7L12 12L22 7L12 2Z"
                fill="white"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M2 17L12 22L22 17"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M2 12L12 17L22 12"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white"></div>
        </div>
        <div>
          <div className="text-xs font-semibold text-gray-900">
            Solvium Agent
          </div>
          <div className="text-[10px] text-gray-500">Support Agent</div>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <button className="text-gray-400 hover:text-gray-600">
          <ThumbsUp className="w-4 h-4" />
        </button>
        <button className="text-gray-400 hover:text-gray-600">
          <ThumbsDown className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// Extra Mobile Button Component
const ExtraMobileButton = () => {
  return (
    <button className="text-gray-400 hover:text-gray-600 p-1">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    </button>
  );
};

const AIChatAgent = ({ isOpen, onClose }: AIChatAgentProps) => {
  const { account, accountId, isConnected } = usePrivateKeyWallet();

  // Only render when wallet is connected and chat should be open
  if (!isOpen || !isConnected || !account || !accountId) {
    return null;
  }

  // Render BitteAiChat when isOpen is true
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
          /* Set BitteAiChat modal size to match design - 300px width */
          [data-bitte-chat],
          [data-bitte-chat] > div:first-child,
          [data-bitte-chat] > div:first-child > div {
            width: 300px !important;
            min-width: 300px !important;
            max-width: 300px !important;
            height: 520px !important;
            min-height: 520px !important;
            max-height: 90vh !important;
          }
          /* Ensure input field takes available space and buttons align right */
          .bg-gray-50 input[type="text"],
          .bg-gray-50 textarea {
            flex: 1 !important;
            min-width: 0 !important;
            border: none !important;
            outline: none !important;
            background: transparent !important;
          }
          .bg-gray-50 > div:last-child {
            margin-left: auto !important;
            display: flex !important;
            align-items: center !important;
            gap: 0.375rem !important;
          }
        `,
        }}
      />
      <div
        style={{
          position: "fixed",
          bottom: "20px",
          right: "20px",
          zIndex: 10000,
        }}
      >
        <BitteAiChat
          agentId="rhea-ai-eight.vercel.app"
          apiUrl="/api/chat"
          wallet={{
            near: {
              wallet: account as any,
              account: account as any,
              accountId: accountId as string,
              nearWalletId: accountId as string,
            },
          }}
          options={{
            agentName: "Solvium AI Assistant",
            placeholderText: "Write a message",
            customComponents: {
              welcomeMessageComponent: (<CustomWelcome />) as any,
              mobileInputExtraButton: <ExtraMobileButton />,
              messageContainer: CustomMessageContainer,
              chatContainer: CustomChatContainer,
              inputContainer: CustomInputContainer,
              sendButtonComponent: CustomSendButton,
              loadingIndicator: CustomLoadingIndicator,
            },
          }}
        />
      </div>
    </>
  );
};

export default AIChatAgent;

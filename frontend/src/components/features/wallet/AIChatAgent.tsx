"use client";

import { usePrivateKeyWallet } from "@/contexts/PrivateKeyWalletContext";
import { BitteAiChat } from "@bitte-ai/chat";
import "@bitte-ai/chat/styles.css";
import {
  X,
  Minus,
  ThumbsUp,
  ThumbsDown,
  Smile,
  Paperclip,
  Send,
} from "lucide-react";
import React, { ComponentType } from "react";

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
  showBorder?: boolean;
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

// Custom Welcome Message Component
const CustomWelcomeMessage = () => {
  return (
    <div className="space-y-3">
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
            Livechat{" "}
            {new Date().toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
          <div className="bg-white rounded-lg rounded-tl-none px-3 py-2 shadow-sm">
            <p className="text-xs text-gray-700">
              Hi, I am your solvium assistant
            </p>
          </div>
        </div>
      </div>
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
            Livechat{" "}
            {new Date().toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
          <div className="bg-white rounded-lg rounded-tl-none px-3 py-2 shadow-sm">
            <p className="text-xs text-gray-700">
              You can say things like &quot;Send 10 SOLV to AjeMark&quot; or
              &quot;Check my balance.&quot;
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Custom Message Container Component
const CustomMessageContainer: ComponentType<MessageGroupComponentProps> = ({
  message,
  isUser,
  children,
  uniqueKey,
}) => {
  const timestamp = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isUser) {
    return (
      <div key={uniqueKey} className="flex flex-col items-end">
        <div className="text-[10px] text-gray-500 mb-0.5">
          Visitor {timestamp}
        </div>
        <div className="bg-blue-600 rounded-lg rounded-tr-none px-3 py-2 max-w-[80%]">
          <div className="text-xs text-white">{children}</div>
        </div>
        <div className="text-[10px] text-gray-500 mt-0.5">Read</div>
      </div>
    );
  }

  return (
    <div key={uniqueKey} className="flex items-start gap-1.5">
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
          <div className="text-xs text-gray-700">{children}</div>
        </div>
      </div>
    </div>
  );
};

// Custom Chat Container Component
const CustomChatContainer: ComponentType<ChatContainerComponentProps> = ({
  children,
}) => {
  const [showWelcome, setShowWelcome] = React.useState(true);

  React.useEffect(() => {
    // Hide welcome message once there are actual messages
    const hasMessages = React.Children.count(children) > 0;
    if (hasMessages) {
      setShowWelcome(false);
    }
  }, [children]);

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-3 space-y-3">
      {showWelcome && <CustomWelcomeMessage />}
      {children}
    </div>
  );
};

// Custom Input Container Component
const CustomInputContainer: ComponentType<InputContainerProps> = ({
  children,
}) => {
  return (
    <div className="bg-white border-t border-gray-200 p-3 flex-shrink-0">
      <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2.5 py-1.5">
        {children}
        <button className="text-gray-400 hover:text-gray-600">
          <Smile className="w-4 h-4" />
        </button>
        <button className="text-gray-400 hover:text-gray-600">
          <Paperclip className="w-4 h-4" />
        </button>
      </div>
      <div className="text-center text-[10px] text-gray-500 mt-1.5">
        Powered by <span className="font-semibold">Solvium Agent</span>
      </div>
    </div>
  );
};

// Custom Send Button Component
const CustomSendButton: ComponentType<SendButtonComponentProps> = ({
  input,
  isLoading,
  onClick,
}) => {
  return (
    <button
      onClick={onClick}
      disabled={isLoading || !input.trim()}
      className="text-blue-600 hover:text-blue-700 disabled:opacity-50"
    >
      <Send className="w-4 h-4" />
    </button>
  );
};

// Custom Loading Indicator Component
const CustomLoadingIndicator: ComponentType<
  LoadingIndicatorComponentProps
> = () => {
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
      <div className="flex-1">
        <div className="text-[10px] text-gray-500 mb-0.5">Livechat</div>
        <div className="bg-white rounded-lg rounded-tl-none px-3 py-2 shadow-sm">
          <div className="flex gap-1">
            <div
              className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
              style={{ animationDelay: "0ms" }}
            ></div>
            <div
              className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
              style={{ animationDelay: "150ms" }}
            ></div>
            <div
              className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
              style={{ animationDelay: "300ms" }}
            ></div>
          </div>
        </div>
      </div>
    </div>
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
      <div className="fixed bottom-28 right-3 z-[9999] pointer-events-none">
        <div className="w-[300px] h-[520px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden pointer-events-auto">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-3 py-2.5 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <button className="text-gray-400 hover:text-gray-600">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle cx="4" cy="10" r="1.5" fill="currentColor" />
                  <circle cx="10" cy="10" r="1.5" fill="currentColor" />
                  <circle cx="16" cy="10" r="1.5" fill="currentColor" />
                </svg>
              </button>
              <span className="text-gray-600 text-xs font-medium">
                Chat with us!
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <Minus className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Agent Info */}
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

          <div className="flex-1 min-h-0 flex flex-col">
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
                agentName: "Solvium Agent",
                agentImage: "/logo.png",
                placeholderText: "Write a message",
                customComponents: {
                  messageContainer: CustomMessageContainer,
                  chatContainer: CustomChatContainer,
                  inputContainer: CustomInputContainer,
                  sendButtonComponent: CustomSendButton,
                  loadingIndicator: CustomLoadingIndicator,
                },
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default AIChatAgent;

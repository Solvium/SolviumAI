"use client";

import { usePrivateKeyWallet } from "@/contexts/PrivateKeyWalletContext";
import { BitteAiChat } from "@bitte-ai/chat";
import "@bitte-ai/chat/styles.css";
import { X, Minus, ThumbsUp, Send } from "lucide-react";
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
      <div className="flex items-start gap-1">
        <div className="flex-shrink-0 w-4 h-4 bg-blue-600 rounded flex items-center justify-center">
          <svg
            width="10"
            height="10"
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
        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-gray-500 mb-0.5">
            Livechat{" "}
            {new Date().toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
          <div className="bg-blue-600 rounded-lg rounded-tl-none px-3 py-2 shadow-sm max-w-full">
            <p className="bitte-message-content text-xs text-white">
              Hi, I am your solvium assistant
            </p>
          </div>
        </div>
      </div>
      <div className="flex items-start gap-1">
        <div className="flex-shrink-0 w-4 h-4 bg-blue-600 rounded flex items-center justify-center">
          <svg
            width="10"
            height="10"
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
        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-gray-500 mb-0.5">
            Livechat{" "}
            {new Date().toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
          <div className="bg-blue-600 rounded-lg rounded-tl-none px-3 py-2 shadow-sm max-w-full">
            <p className="bitte-message-content text-xs text-white">
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
  React.useEffect(() => {
    // Inject styles for proper text wrapping in message bubbles
    const styleId = "bitte-message-wrap";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        .bitte-message-content {
          word-wrap: break-word !important;
          overflow-wrap: break-word !important;
          word-break: break-word !important;
          white-space: pre-wrap !important;
          max-width: 100% !important;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

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
          <div className="bitte-message-content text-xs text-white">
            {children}
          </div>
        </div>
        <div className="text-[10px] text-gray-500 mt-0.5">Read</div>
      </div>
    );
  }

  return (
    <div key={uniqueKey} className="flex items-start gap-1">
      <div className="flex-shrink-0 w-4 h-4 bg-blue-600 rounded flex items-center justify-center">
        <svg
          width="10"
          height="10"
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
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-gray-500 mb-0.5">
          Livechat {timestamp}
        </div>
        <div className="bg-blue-600 rounded-lg rounded-tl-none px-3 py-2 shadow-sm max-w-full">
          <div className="bitte-message-content text-xs text-white">
            {children}
          </div>
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
    <div className="flex-1 overflow-y-auto bg-gray-50 pl-2 pr-3 pt-3 pb-3 space-y-3">
      {showWelcome && <CustomWelcomeMessage />}
      {children}
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
        <div className="bg-blue-600 rounded-lg rounded-tl-none px-3 py-2 shadow-sm">
          <div className="flex gap-1">
            <div
              className="w-2 h-2 bg-white rounded-full animate-bounce"
              style={{ animationDelay: "0ms" }}
            ></div>
            <div
              className="w-2 h-2 bg-white rounded-full animate-bounce"
              style={{ animationDelay: "150ms" }}
            ></div>
            <div
              className="w-2 h-2 bg-white rounded-full animate-bounce"
              style={{ animationDelay: "300ms" }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Custom Input Container Component (Fixed)
const CustomInputContainerFixed: ComponentType<InputContainerProps> = ({
  children,
}) => {
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    // Inject styles to ensure input is white and visible with smaller text
    const styleId = "bitte-input-override";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        .bitte-input-wrapper input,
        .bitte-input-wrapper textarea {
          background-color: white !important;
          color: #111827 !important;
          border: none !important;
          outline: none !important;
          font-size: 12px !important;
          line-height: 1.5 !important;
        }
        .bitte-input-wrapper input::placeholder,
        .bitte-input-wrapper textarea::placeholder {
          color: #9ca3af !important;
          font-size: 12px !important;
        }
        /* Target any input inside the wrapper with more specificity */
        .bitte-input-wrapper * input,
        .bitte-input-wrapper * textarea {
          background-color: white !important;
          color: #111827 !important;
          font-size: 12px !important;
        }
        /* Even more specific selectors */
        .bitte-input-wrapper input[type="text"],
        .bitte-input-wrapper textarea {
          background-color: white !important;
          color: #111827 !important;
          font-size: 12px !important;
        }
      `;
      document.head.appendChild(style);
    }

    // Also directly style any input elements found in the wrapper
    if (wrapperRef.current) {
      const inputs = wrapperRef.current.querySelectorAll("input, textarea");
      inputs.forEach((input) => {
        (input as HTMLElement).style.backgroundColor = "white";
        (input as HTMLElement).style.color = "#111827";
        (input as HTMLElement).style.fontSize = "12px";
        (input as HTMLElement).style.border = "none";
        (input as HTMLElement).style.outline = "none";
      });
    }
  }, [children]);

  return (
    <div className="bg-white border-t border-gray-200 p-3 flex-shrink-0">
      <div
        ref={wrapperRef}
        className="bitte-input-wrapper flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5"
      >
        {children}
      </div>
      <div className="text-center text-[10px] text-gray-500 mt-1.5">
        Powered by <span className="font-semibold">Solvium Agent</span>
      </div>
    </div>
  );
};

const AIChatAgent = ({ isOpen, onClose }: AIChatAgentProps) => {
  const { account, accountId, isConnected } = usePrivateKeyWallet();

  // Hide the share button using its specific classes
  React.useEffect(() => {
    if (!isOpen) return;

    const styleId = "bitte-hide-share-button";
    let styleElement = document.getElementById(styleId) as HTMLStyleElement;

    if (!styleElement) {
      styleElement = document.createElement("style");
      styleElement.id = styleId;
      document.head.appendChild(styleElement);
    }

    styleElement.textContent = `
      /* Hide share button by targeting its specific classes */
      button:has(svg.lucide-share),
      button:has(.lucide-share),
      .bitte-absolute.bitte-right-6.bitte-top-6,
      .bitte-absolute.bitte-right-6.bitte-top-6 button,
      button[class*="bitte-bg-black"]:has(svg.lucide-share),
      div.bitte-absolute.bitte-right-6.bitte-top-6.bitte-z-50 {
        display: none !important;
        visibility: hidden !important;
      }
      /* Alternative selector for browsers that don't support :has() */
      .lucide-share {
        display: none !important;
      }
      button svg.lucide-share {
        display: none !important;
      }
    `;

    // Also directly hide the buttons using JavaScript
    const hideShareButtons = () => {
      // Target the container div
      const shareContainer = document.querySelector(
        ".bitte-absolute.bitte-right-6.bitte-top-6.bitte-z-50"
      );
      if (shareContainer) {
        (shareContainer as HTMLElement).style.display = "none";
        (shareContainer as HTMLElement).style.visibility = "hidden";
      }

      // Target buttons with lucide-share SVG
      const buttons = document.querySelectorAll("button");
      buttons.forEach((button) => {
        const shareIcon = button.querySelector("svg.lucide-share");
        if (shareIcon) {
          (button as HTMLElement).style.display = "none";
          (button as HTMLElement).style.visibility = "hidden";
        }
      });
    };

    // Run immediately and on mutations
    hideShareButtons();
    const observer = new MutationObserver(hideShareButtons);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      if (styleElement && styleElement.parentNode) {
        styleElement.parentNode.removeChild(styleElement);
      }
    };
  }, [isOpen]);

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
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
                title="Close chat"
              >
                <X className="w-4 h-4" />
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
                  inputContainer: CustomInputContainerFixed,
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

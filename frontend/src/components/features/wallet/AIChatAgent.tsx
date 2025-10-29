"use client";

import { useState, useRef, useEffect } from "react";
import { X, Minus, ThumbsUp, ThumbsDown, Smile, Paperclip, Send } from "lucide-react";

interface Message {
  id: string;
  sender: "agent" | "user";
  text: string;
  timestamp: string;
  status?: "sent" | "read";
}

interface AIChatAgentProps {
  isOpen: boolean;
  onClose: () => void;
}

const AIChatAgent = ({ isOpen, onClose }: AIChatAgentProps) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      sender: "agent",
      text: "Hi, I am your solvium assistant",
      timestamp: "02:10 PM",
    },
    {
      id: "2",
      sender: "agent",
      text: 'You can say things like "Send 10 SOLV to AjeMark" or "Check my balance."',
      timestamp: "02:10 PM",
    },
    {
      id: "3",
      sender: "user",
      text: "Welcome",
      timestamp: "02:15 PM",
      status: "read",
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!inputValue.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      sender: "user",
      text: inputValue,
      timestamp: new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      status: "read",
    };

    setMessages([...messages, newMessage]);
    setInputValue("");

    // Simulate agent response
    setTimeout(() => {
      const agentResponse: Message = {
        id: (Date.now() + 1).toString(),
        sender: "agent",
        text: "I'm processing your request. This is a demo response.",
        timestamp: new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setMessages((prev) => [...prev, agentResponse]);
    }, 1000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
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

        {/* Messages */}
        <div className="flex-1 overflow-y-auto bg-gray-50 p-3 space-y-3">
          {messages.map((message) => (
            <div key={message.id}>
              {message.sender === "agent" ? (
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
                      Livechat {message.timestamp}
                    </div>
                    <div className="bg-white rounded-lg rounded-tl-none px-3 py-2 shadow-sm">
                      <p className="text-xs text-gray-700">{message.text}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-end">
                  <div className="text-[10px] text-gray-500 mb-0.5">
                    Visitor {message.timestamp}
                  </div>
                  <div className="bg-blue-600 rounded-lg rounded-tr-none px-3 py-2 max-w-[80%]">
                    <p className="text-xs text-white">{message.text}</p>
                  </div>
                  {message.status && (
                    <div className="text-[10px] text-gray-500 mt-0.5">
                      {message.status === "read" ? "Read" : "Sent"}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="bg-white border-t border-gray-200 p-3 flex-shrink-0">
          <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2.5 py-1.5">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Write a message"
              className="flex-1 bg-transparent text-xs text-gray-900 placeholder-gray-400 outline-none"
            />
            <button className="text-gray-400 hover:text-gray-600">
              <Smile className="w-4 h-4" />
            </button>
            <button className="text-gray-400 hover:text-gray-600">
              <Paperclip className="w-4 h-4" />
            </button>
            <button
              onClick={handleSend}
              className="text-blue-600 hover:text-blue-700"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <div className="text-center text-[10px] text-gray-500 mt-1.5">
            Powered by <span className="font-semibold">Solvium Agent</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIChatAgent;

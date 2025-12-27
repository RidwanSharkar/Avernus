import React, { useState, useRef, useEffect } from 'react';
import { useMultiplayer } from '@/contexts/MultiplayerContext';

interface ChatUIProps {
  isVisible?: boolean;
}

export default function ChatUI({ isVisible = true }: ChatUIProps) {
  const { chatMessages, isChatOpen, sendChatMessage, openChat, closeChat } = useMultiplayer();
  const [inputMessage, setInputMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isChatOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isChatOpen]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (inputMessage.trim()) {
        sendChatMessage(inputMessage.trim());
        setInputMessage('');
      }
      closeChat();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeChat();
      setInputMessage('');
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputMessage(event.target.value);
  };

  if (!isVisible) return null;

  return (
    <>
      {/* Chat Messages Display */}
      <div className="fixed bottom-14 right-5 z-50 max-w-xs">
        <div className="bg-black bg-opacity-30 backdrop-blur-sm rounded-lg border border-gray-600 p-2 max-h-24 overflow-y-auto">
          {chatMessages.length > 0 ? (
            <div className="space-y-0.125">
              {chatMessages.map((message) => (
                <div key={message.id} className="text-sm">
                  <span className="text-blue-400 font-small">{message.playerName}:</span>
                  <span className="text-white ml-1">{message.message}</span>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          ) : (
            <div className="text-gray-400 text-xs text-center py-0">
              Enter to chat
            </div>
          )}
        </div>
      </div>

      {/* Chat Input */}
      {isChatOpen && (
        <div className="fixed bottom-32 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-black bg-opacity-90 backdrop-blur-sm rounded-lg border border-gray-600 p-2 min-w-96">
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type your message... (Enter or Esc)"
              className="w-full bg-transparent text-white placeholder-gray-400 outline-none border-none"
              maxLength={150}
              autoComplete="off"
            />
          </div>
        </div>
      )}
    </>
  );
}

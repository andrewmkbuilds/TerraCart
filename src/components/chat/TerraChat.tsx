import React, { useState, useRef, useEffect } from 'react'
import { useTerraStore, ChatMessage } from '../../store'
import { processUserMessage } from '../../ai/chat'

export function TerraChat() {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { chatMessages, isChatLoading, addChatMessage, setChatLoading } = useTerraStore()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const handleSend = async () => {
    const message = input.trim()
    if (!message || isChatLoading) return

    setInput('')

    // Add user message
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: Date.now(),
    }
    addChatMessage(userMsg)

    // Process and get AI response
    setChatLoading(true)
    try {
      const response = await processUserMessage(message)
      const aiMsg: ChatMessage = {
        id: `msg-${Date.now()}-ai`,
        role: 'assistant',
        content: response.content,
        timestamp: Date.now(),
        metadata: response.metadata,
      }
      addChatMessage(aiMsg)
    } catch (error) {
      addChatMessage({
        id: `msg-${Date.now()}-err`,
        role: 'assistant',
        content: "I'm sorry, I couldn't process that request. Please try again.",
        timestamp: Date.now(),
      })
    } finally {
      setChatLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const suggestedPrompts = [
    'Is this worth it?',
    'Find me a reusable alternative',
    'What about packaging?',
    'Compare with alternatives',
  ]

  return (
    <div className="flex flex-col h-full">
      <div className="terra-label px-1 mb-2">💬 Ask TerraCart</div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto terra-scroll space-y-3 mb-3 min-h-0" style={{ maxHeight: '300px' }}>
        {chatMessages.length === 0 && (
          <div className="text-center py-6">
            <img src="/assets/terracart-logo.png?v=20260826" alt="TerraCart" className="w-16 h-16 object-contain mx-auto mb-2" />
            <p className="text-sm text-gray-400">
              Ask me anything about the product you're viewing
            </p>
          </div>
        )}

        {chatMessages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-assistant'}>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              {msg.metadata?.sources && (
                <div className="mt-2 pt-2 border-t border-white/20 text-[10px] opacity-70">
                  Sources: {msg.metadata.sources.join(', ')}
                </div>
              )}
            </div>
          </div>
        ))}

        {isChatLoading && (
          <div className="flex justify-start">
            <div className="chat-bubble-assistant">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested prompts */}
      {chatMessages.length === 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {suggestedPrompts.map((prompt) => (
            <button
              key={prompt}
              onClick={() => {
                setInput(prompt)
                setTimeout(() => inputRef.current?.focus(), 100)
              }}
              className="terra-btn-outline text-xs"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about this product..."
          className="terra-input flex-1"
          disabled={isChatLoading}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isChatLoading}
          className="terra-btn-primary px-3 py-2 text-sm disabled:opacity-40"
        >
          →
        </button>
      </div>
    </div>
  )
}

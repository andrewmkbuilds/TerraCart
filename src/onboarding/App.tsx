import React, { useState } from 'react'
import { useTerraStore } from '../store'

type Step = 'welcome' | 'permissions' | 'data-control' | 'complete'

export function OnboardingApp() {
  const [step, setStep] = useState<Step>('welcome')
  const { setFirstRun } = useTerraStore()

  const handleComplete = () => {
    setFirstRun(false)
    // Try to close the window or redirect
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.getCurrent((tab) => {
        if (tab?.id) chrome.tabs.remove(tab.id)
      })
    } else {
      window.close()
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-terra-600 via-terra-700 to-terra-900 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {step === 'welcome' && (
          <div className="bg-white rounded-2xl shadow-2xl p-8 text-center animate-slide-up">
            <div className="text-6xl mb-4">🌍</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Welcome to TerraCart
            </h1>
            <p className="text-terra-600 font-medium mb-4">
              Your AI Copilot for Smarter Shopping
            </p>
            <p className="text-sm text-gray-500 leading-relaxed mb-8">
              TerraCart helps you make smarter, more sustainable purchasing decisions while you shop online.
              It sits alongside your favorite stores and uses AI to understand products, research alternatives,
              and provide personalized recommendations.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => setStep('permissions')}
                className="w-full terra-btn-primary py-3 text-base"
              >
                Get Started →
              </button>
              <button
                onClick={handleComplete}
                className="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                Skip for now
              </button>
            </div>
          </div>
        )}

        {step === 'permissions' && (
          <div className="bg-white rounded-2xl shadow-2xl p-8 animate-slide-up">
            <div className="text-center mb-6">
              <div className="text-4xl mb-3">🔐</div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                You control your data
              </h2>
              <p className="text-sm text-gray-500">
                TerraCart needs permission to understand product pages while you shop.
              </p>
            </div>

            <div className="space-y-3 mb-8">
              <div className="p-4 rounded-xl bg-green-50 border border-green-100">
                <div className="text-sm font-semibold text-green-800 mb-2">
                  ✓ What TerraCart uses
                </div>
                <ul className="space-y-1.5 text-sm text-green-700">
                  <li className="flex items-center gap-2">
                    <span className="text-green-500">✓</span> Product information from pages you visit
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-500">✓</span> Your shopping preferences (stored locally)
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-500">✓</span> TerraCart shopping history (you control this)
                  </li>
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <div className="text-sm font-semibold text-gray-700 mb-2">
                  ✕ What TerraCart doesn't need
                </div>
                <ul className="space-y-1.5 text-sm text-gray-500">
                  <li className="flex items-center gap-2">
                    <span className="text-gray-400">✕</span> Passwords
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-gray-400">✕</span> Payment details
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-gray-400">✕</span> Private messages
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-gray-400">✕</span> Unrelated browsing activity
                  </li>
                </ul>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => setStep('data-control')}
                className="w-full terra-btn-primary py-3 text-base"
              >
                Continue
              </button>
              <button
                onClick={() => setStep('welcome')}
                className="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                ← Back
              </button>
            </div>
          </div>
        )}

        {step === 'data-control' && (
          <div className="bg-white rounded-2xl shadow-2xl p-8 animate-slide-up">
            <div className="text-center mb-6">
              <div className="text-4xl mb-3">⚙️</div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Data & Privacy Controls
              </h2>
              <p className="text-sm text-gray-500">
                You're always in control. Here's what you can do:
              </p>
            </div>

            <div className="space-y-3 mb-8">
              <ControlRow
                icon="⏸"
                title="Pause TerraCart"
                description="Temporarily disable all analysis"
              />
              <ControlRow
                icon="🚫"
                title="Disable on Specific Sites"
                description="Choose which websites TerraCart runs on"
              />
              <ControlRow
                icon="🗑"
                title="Delete Shopping History"
                description="Remove all stored data at any time"
              />
              <ControlRow
                icon="📊"
                title="Choose Your Style"
                description="Set whether you want most sustainable, best value, or balanced recommendations"
              />
            </div>

            <div className="space-y-2">
              <button
                onClick={handleComplete}
                className="w-full terra-btn-primary py-3 text-base"
              >
                Enable TerraCart 🌍
              </button>
              <button
                onClick={() => setStep('permissions')}
                className="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                ← Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ControlRow({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50">
      <span className="text-xl mt-0.5">{icon}</span>
      <div>
        <div className="text-sm font-semibold text-gray-800">{title}</div>
        <div className="text-xs text-gray-500 mt-0.5">{description}</div>
      </div>
    </div>
  )
}

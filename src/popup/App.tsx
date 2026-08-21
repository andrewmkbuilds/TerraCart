import React, { useState, useEffect } from 'react'
import { useTerraStore } from '../store'
import { EcoScoreRing } from '../components/shared/EcoScoreRing'
import { calculateEcoScore, generateVerdict } from '../ai/engine'
import type { Product } from '../types'

export function PopupApp() {
  const { isPaused, preferences, setPaused } = useTerraStore()
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null)
  const [websiteName, setWebsiteName] = useState('No active page')
  const [pageTitle, setPageTitle] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [productDetected, setProductDetected] = useState(false)
  const [sidePanelAvailable, setSidePanelAvailable] = useState(false)

  useEffect(() => {
    // Check if side panel API is available
    setSidePanelAvailable(typeof chrome !== 'undefined' && !!chrome.sidePanel)

    // Query the active tab
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        const tab = tabs[0]
        if (tab?.url) {
          try {
            const url = new URL(tab.url)
            setWebsiteName(url.hostname)
            setPageTitle(tab.title || '')
          } catch {
            setWebsiteName(tab.title || 'Unknown page')
          }

          // Get cached scan data from background
          try {
            const scanData = await new Promise<any>((resolve) => {
              chrome.runtime?.sendMessage({ type: 'GET_TAB_SCAN_DATA', tabId: tab.id }, (response) => {
                resolve(response)
              })
            })

            if (scanData?.primaryProduct) {
              setCurrentProduct(scanData.primaryProduct)
              setProductDetected(true)
            } else if (scanData?.productCount > 0) {
              setProductDetected(true)
            }
          } catch {
            // No scan data available
          }
        }
      })
    }
  }, [])

  const handleOpenCopilot = async () => {
    if (typeof chrome !== 'undefined' && chrome.sidePanel) {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        if (tab?.windowId) {
          await chrome.sidePanel.open({ windowId: tab.windowId })
        }
      } catch (e) {
        console.warn('Could not open side panel:', e)
      }
    }
  }

  const handleScanPage = async () => {
    setIsScanning(true)
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab?.id) {
        // Request scan from background
        const result = await new Promise<any>((resolve) => {
          chrome.runtime?.sendMessage({ type: 'SCAN_PAGE' }, (response) => {
            resolve(response)
          })
        })

        if (result?.primaryProduct) {
          setCurrentProduct(result.primaryProduct)
          setProductDetected(true)
        } else if (result?.products?.length > 0) {
          setProductDetected(true)
        }
      }
    } catch (err) {
      console.warn('Scan failed:', err)
    } finally {
      setIsScanning(false)
    }
  }

  const handleOpenCopilotAndScan = async () => {
    await handleOpenCopilot()
  }

  const currentEcoScore = currentProduct
    ? calculateEcoScore(currentProduct, preferences)
    : null

  const verdict = currentEcoScore && currentProduct
    ? generateVerdict(currentEcoScore, currentProduct)
    : null

  return (
    <div className="w-[340px] min-h-[420px] bg-white flex flex-col">
      {/* Header */}
      <div className="p-5 pb-4 bg-gradient-to-br from-terra-600 to-terra-800 text-white">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">🌍</span>
          <div>
            <h1 className="text-xl font-bold">TerraCart</h1>
            <p className="text-sm text-terra-100">Your AI Shopping Copilot</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
            isPaused ? 'bg-white/20' : 'bg-green-500/30'
          }`}>
            <span className={`w-2 h-2 rounded-full ${isPaused ? 'bg-yellow-300' : 'bg-green-300'}`} />
            {isPaused ? 'Paused' : 'Active'}
          </span>
        </div>
      </div>

      {/* Current Website */}
      <div className="px-5 py-3 border-b border-gray-100">
        <div className="text-xs text-gray-400 font-medium">Shopping on</div>
        <div className="text-sm font-semibold text-gray-700 mt-0.5 truncate">{websiteName}</div>
        {pageTitle && (
          <div className="text-[11px] text-gray-400 mt-0.5 truncate">{pageTitle}</div>
        )}
      </div>

      {/* Product Status */}
      {currentProduct ? (
        <div className="px-5 py-3 border-b border-gray-100">
          <div className="text-xs text-gray-400 font-medium">Product detected</div>
          <div className="text-sm font-medium text-gray-700 mt-0.5 line-clamp-2">{currentProduct.name}</div>
          {currentProduct.price > 0 && (
            <div className="text-xs text-gray-500 mt-0.5">{currentProduct.currency} {currentProduct.price.toFixed(2)}</div>
          )}
          <div className="flex items-center gap-3 mt-2">
            {currentEcoScore && (
              <div className="flex items-center gap-2">
                <EcoScoreRing score={currentEcoScore.overall} size={56} strokeWidth={5} showLabel={false} />
                <div>
                  <div className="text-xs text-gray-400">Eco Score</div>
                  <div className="text-sm font-bold text-gray-700">{currentEcoScore.overall}/10</div>
                </div>
              </div>
            )}
            {verdict && (
              <div className="flex items-center gap-1.5">
                <span className="text-lg">{verdict.emoji}</span>
                <span className="text-sm font-medium text-gray-700">{verdict.label}</span>
              </div>
            )}
          </div>
        </div>
      ) : productDetected ? (
        <div className="px-5 py-3 border-b border-gray-100">
          <div className="text-xs text-gray-400 font-medium">Products found on this page</div>
          <div className="text-sm text-gray-500 mt-0.5">Open the copilot to see details</div>
        </div>
      ) : (
        <div className="px-5 py-6 text-center">
          <div className="text-3xl mb-2">🔍</div>
          <p className="text-sm text-gray-500">No product detected</p>
          <p className="text-xs text-gray-400 mt-1">Browse to a product page and TerraCart will analyze it</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="p-5 space-y-2 mt-auto">
        <button
          onClick={handleOpenCopilotAndScan}
          className="w-full terra-btn-primary py-3 text-sm flex items-center justify-center gap-2"
        >
          <span>🚀</span>
          Open TerraCart
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={handleScanPage} className="terra-btn-secondary text-xs py-2.5" disabled={isScanning}>
            {isScanning ? '⏳ Scanning...' : '📄 Scan Page'}
          </button>
          <button onClick={handleOpenCopilot} className="terra-btn-secondary text-xs py-2.5">
            ⚙️ My Preferences
          </button>
        </div>
        <button
          onClick={() => setPaused(!isPaused)}
          className="w-full terra-btn-outline text-xs py-2 border-gray-200 text-gray-500"
        >
          {isPaused ? '▶️ Resume TerraCart' : '⏸ Pause TerraCart'}
        </button>
      </div>

      {/* Footer */}
      <div className="px-5 py-2 bg-gray-50 border-t border-gray-100 text-center">
        <p className="text-[10px] text-gray-400">TerraCart v1.0 · Your AI Copilot for Smarter Shopping</p>
      </div>
    </div>
  )
}

import React from 'react'
import type { Product } from '../../types'

interface ProductCardProps {
  product: Product
  ecoScore?: number
  badge?: string
  onClick?: () => void
  compact?: boolean
  showPrice?: boolean
}

export function ProductCard({ product, ecoScore, badge, onClick, compact = false, showPrice = true }: ProductCardProps) {
  const scoreColor = ecoScore
    ? ecoScore >= 8
      ? 'text-green-600 bg-green-50'
      : ecoScore >= 6
      ? 'text-lime-600 bg-lime-50'
      : ecoScore >= 4
      ? 'text-amber-600 bg-amber-50'
      : 'text-red-600 bg-red-50'
    : null

  return (
    <div
      className={`terra-card p-3 cursor-pointer hover:shadow-md transition-all duration-200 ${
        compact ? 'flex items-center gap-3' : ''
      } ${onClick ? 'hover:border-terra-200' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {compact ? (
        // Compact horizontal layout
        <>
          <div className="w-14 h-14 rounded-lg bg-gray-50 flex items-center justify-center text-2xl shrink-0 overflow-hidden">
            {product.image ? (
              <img src={product.image} alt="" className="w-full h-full object-cover" />
            ) : (
              '📦'
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-sm font-medium text-gray-800 truncate">{product.name}</h4>
              {ecoScore && (
                <span className={`terra-badge shrink-0 ${scoreColor}`}>
                  {ecoScore.toFixed(1)}
                </span>
              )}
            </div>
            {showPrice && (
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm font-semibold text-gray-700">
                  {product.currency} {product.price.toFixed(2)}
                </span>
                {product.brand && (
                  <span className="text-xs text-gray-400">· {product.brand}</span>
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        // Vertical card layout
        <>
          <div className="w-full h-32 rounded-lg bg-gray-50 flex items-center justify-center text-4xl overflow-hidden mb-3">
            {product.image ? (
              <img src={product.image} alt="" className="w-full h-full object-cover" />
            ) : (
              '📦'
            )}
          </div>
          <div className="space-y-1">
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-sm font-medium text-gray-800 line-clamp-2 leading-snug">
                {product.name}
              </h4>
              {ecoScore && (
                <span className={`terra-badge shrink-0 ${scoreColor}`}>
                  {ecoScore.toFixed(1)}
                </span>
              )}
            </div>
            {showPrice && (
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-gray-800">
                  {product.currency} {product.price.toFixed(2)}
                </span>
              </div>
            )}
            <p className="text-xs text-gray-400 line-clamp-2">{product.description}</p>
          </div>
          {badge && (
            <div className="mt-2">
              <span className="terra-badge bg-terra-50 text-terra-700 border border-terra-200">
                {badge}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  )
}

import { ExternalLink } from 'lucide-react'
import type { DetectedProduct } from '../../types'
import { formatPrice, hostLabel } from '../../utils/format'

interface Props {
  product: DetectedProduct
  status?: string
}

export default function ProductHeadline({ product, status }: Props) {
  const price = formatPrice(product.price, product.currency)
  return (
    <div className="flex items-start gap-2.5">
      {product.image ? (
        <img
          src={product.image}
          alt=""
          className="h-12 w-12 shrink-0 rounded-xl border border-line object-cover"
          onError={(event) => {
            ;(event.currentTarget as HTMLImageElement).style.display = 'none'
          }}
        />
      ) : (
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-line bg-surface-alt text-[15px] font-bold text-muted">
          {product.name.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[12.5px] font-semibold leading-snug tracking-tight">{product.name}</p>
        <p className="mt-1 flex items-center gap-1 text-[10.5px] text-muted">
          <span className="truncate">{product.brand || hostLabel(product.hostname)}</span>
          {price && <span className="text-ink">· {price}</span>}
        </p>
        {status && <p className="mt-0.5 text-[10px] text-muted">{status}</p>}
      </div>
      <a
        href={product.url}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-ghost mt-0.5 h-6 w-6 shrink-0 text-muted"
        aria-label="Open product page"
      >
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  )
}
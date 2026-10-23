import { Share2 } from 'lucide-react'
import { useState } from 'react'
import { appShareUrl, shareApp } from '../../lib/shareApp'

const cardClass =
  'rounded-xl border border-boss-gold/30 bg-card p-4 text-left text-sm font-semibold shadow-sm shadow-boss-gold/15 transition-colors hover:border-boss-gold/50 hover:shadow-md hover:shadow-boss-gold/25'

const linkClass = 'text-left hover:text-boss-green'

export function ShareAppButton({ variant = 'card' }: { variant?: 'card' | 'link' }) {
  const [message, setMessage] = useState('')

  async function onShare() {
    setMessage('')
    try {
      const result = await shareApp()
      setMessage(result === 'copied' ? 'Link copied' : 'Shared')
      window.setTimeout(() => setMessage(''), 2500)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setMessage(`Copy this link: ${appShareUrl()}`)
    }
  }

  return (
    <button type="button" onClick={onShare} className={variant === 'card' ? cardClass : linkClass}>
      <span className={variant === 'card' ? 'flex items-center gap-2' : undefined}>
        {variant === 'card' && <Share2 className="h-4 w-4 shrink-0 text-boss-gold" strokeWidth={2} />}
        Share Package Boss
      </span>
      {message && (
        <span className={`block font-normal text-muted ${variant === 'card' ? 'mt-1 text-xs' : 'ml-2 inline text-xs'}`}>
          {message}
        </span>
      )}
    </button>
  )
}

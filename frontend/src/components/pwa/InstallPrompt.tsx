import { Download, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '../ui/Button'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem('pwa-install-dismissed') === 'true',
  )

  useEffect(() => {
    function handleBeforeInstall(e: Event) {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
  }, [])

  if (!deferredPrompt || dismissed) return null

  async function handleInstall() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    if (choice.outcome === 'accepted') {
      setDeferredPrompt(null)
    }
  }

  function handleDismiss() {
    setDismissed(true)
    localStorage.setItem('pwa-install-dismissed', 'true')
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-lg rounded-xl border border-boss-green/30 bg-card p-4 shadow-lg md:left-auto">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-boss-green/15">
          <Download className="h-5 w-5 text-boss-green" />
        </div>
        <div className="flex-1">
          <p className="font-bold text-foreground">Install Package Boss</p>
          <p className="mt-1 text-sm text-muted">
            Add to your home screen for quick access to your BOSS address and tracking.
          </p>
          <div className="mt-3 flex gap-2">
            <Button onClick={handleInstall} className="!py-2 !text-xs">
              Install App
            </Button>
            <Button variant="ghost" onClick={handleDismiss} className="!py-2 !text-xs">
              Not now
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss install prompt"
          className="text-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

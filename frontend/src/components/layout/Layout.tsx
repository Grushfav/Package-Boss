import type { ReactNode } from 'react'
import { InstallPrompt } from '../pwa/InstallPrompt'
import { Footer } from './Footer'
import { Header } from './Header'

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col print:block print:min-h-0">
      <Header className="no-print" />
      <main className="flex-1 print:min-h-0">{children}</main>
      <Footer className="no-print" />
      <InstallPrompt />
    </div>
  )
}

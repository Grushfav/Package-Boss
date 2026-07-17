import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Button } from './Button'

interface Props {
  children: ReactNode
  title?: string
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('UI error:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      const detail =
        import.meta.env.DEV && this.state.error.message
          ? this.state.error.message
          : null
      return (
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="text-xl font-bold uppercase text-red-400">
            {this.props.title || 'Something went wrong'}
          </h1>
          {detail && (
            <p className="mt-3 break-words text-left font-mono text-xs text-red-400/90">
              {detail}
            </p>
          )}
          <p className="mt-4 text-sm text-muted">
            Try refreshing the page. If the problem continues, contact support.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button type="button" onClick={() => window.location.reload()}>
              Refresh
            </Button>
            <Link to="/">
              <Button variant="outline" type="button">
                Home
              </Button>
            </Link>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

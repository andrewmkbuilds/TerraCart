import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props {
  children: ReactNode
  label?: string
}

interface State {
  error: Error | null
}

/**
 * Keeps a rendering failure inside one screen: the rest of the extension
 * stays usable and the user can retry instead of facing a blank panel.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('TerraCart render error:', error, info.componentStack)
  }

  reset = () => this.setState({ error: null })

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-clay/15 text-clay">
          <AlertTriangle className="h-5 w-5" strokeWidth={1.8} />
        </div>
        <h3 className="text-[13px] font-semibold tracking-tight">
          {this.props.label || 'This screen could not be displayed'}
        </h3>
        <p className="max-w-[280px] text-[11.5px] leading-relaxed text-muted">
          {this.state.error.message || 'An unexpected error stopped this view from rendering.'}
        </p>
        <button onClick={this.reset} className="btn-primary mt-1">
          Try again
        </button>
      </div>
    )
  }
}
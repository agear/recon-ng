import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return this.props.fallback ?? (
        <div className="card p-5 mt-6">
          <p className="text-xs font-semibold text-red-400 mb-1">Render error</p>
          <p className="text-xs text-red-300">{this.state.error.message}</p>
        </div>
      )
    }
    return this.props.children
  }
}

import { Component, type ReactNode } from 'react'
import i18n from '../i18n'

interface Props {
  children: ReactNode
}
interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-brand-bg flex items-center justify-center p-6">
          <div className="card text-center space-y-3 max-w-xs">
            <div className="text-4xl">😵‍💫</div>
            <p className="font-bold text-gray-700">{i18n.t('ErrorBoundary.title')}</p>
            <button onClick={() => location.reload()} className="btn-primary w-full">
              {i18n.t('ErrorBoundary.reload')}
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

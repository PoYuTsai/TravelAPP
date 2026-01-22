// src/sanity/components/ErrorBoundary.tsx
import { Component, type ReactNode } from 'react'
import { Card, Stack, Text, Button, Code } from '@sanity/ui'
import { sanityLogger } from '../../lib/logger'

interface ErrorBoundaryProps {
  children: ReactNode
  fallbackMessage?: string
  onReset?: () => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: string | null
}

/**
 * ErrorBoundary 元件
 * 用於捕捉子元件的 JavaScript 錯誤，防止整個 Sanity Studio 崩潰
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // 使用統一的 logger 記錄錯誤
    sanityLogger.error('元件渲染錯誤', error, {
      action: 'componentDidCatch',
      componentStack: errorInfo.componentStack,
    })

    this.setState({
      errorInfo: errorInfo.componentStack || null,
    })
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
    this.props.onReset?.()
  }

  render(): ReactNode {
    if (this.state.hasError) {
      const { fallbackMessage = '元件載入時發生錯誤' } = this.props
      const { error, errorInfo } = this.state

      return (
        <Card padding={4} radius={2} shadow={1} tone="critical">
          <Stack space={4}>
            <Text size={2} weight="semibold">
              {fallbackMessage}
            </Text>

            {error && (
              <Card padding={3} radius={2} tone="caution">
                <Stack space={2}>
                  <Text size={1} muted>
                    錯誤訊息：
                  </Text>
                  <Code size={1}>{error.message}</Code>
                </Stack>
              </Card>
            )}

            {errorInfo && (
              <Card padding={3} radius={2} tone="default">
                <Stack space={2}>
                  <Text size={1} muted>
                    錯誤位置：
                  </Text>
                  <Code size={0} style={{ whiteSpace: 'pre-wrap', maxHeight: '150px', overflow: 'auto' }}>
                    {errorInfo}
                  </Code>
                </Stack>
              </Card>
            )}

            <Button
              text="重新載入"
              tone="primary"
              onClick={this.handleReset}
            />
          </Stack>
        </Card>
      )
    }

    return this.props.children
  }
}

/**
 * 高階元件：為任何元件添加錯誤邊界
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallbackMessage?: string
): React.FC<P> {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component'

  const ComponentWithErrorBoundary: React.FC<P> = (props) => (
    <ErrorBoundary fallbackMessage={fallbackMessage}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  )

  ComponentWithErrorBoundary.displayName = `withErrorBoundary(${displayName})`

  return ComponentWithErrorBoundary
}

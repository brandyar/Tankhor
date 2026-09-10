import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from './Button';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught an error]:', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 max-w-2xl mx-auto my-12 bg-white dark:bg-[#12141a] border border-red-200/80 dark:border-red-900/50 rounded-2xl shadow-sm text-center">
          <div className="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-neutral-900 dark:text-white mb-2">
            {this.props.fallbackTitle || 'خطایی در نمایش این بخش رخ داد'}
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4 max-w-md mx-auto leading-relaxed">
            سامانه هنگام پردازش این صفحه با خطای پیش‌بینی‌نشده مواجه شد. می‌توانید با کلیک بر روی دکمه زیر صفحه را مجدداً بارگذاری کنید.
          </p>
          {this.state.error && (
            <div className="mb-6 p-3 bg-neutral-50 dark:bg-neutral-900/80 rounded-lg text-start text-[11px] font-mono text-red-600 dark:text-red-400 border border-neutral-200 dark:border-neutral-800 overflow-x-auto max-h-32">
              {this.state.error.message || String(this.state.error)}
            </div>
          )}
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.hash = '';
                if (this.props.onReset) this.props.onReset();
              }}
              className="gap-2 text-xs"
            >
              <Home className="w-3.5 h-3.5" />
              <span>بازگشت به پیشخوان</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={this.handleRetry}
              className="gap-2 text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>تلاش مجدد</span>
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

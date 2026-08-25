import { Component, type ErrorInfo, type ReactNode } from 'react';

import { invoke } from '@tauri-apps/api/tauri';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  stack: string | null;
}

/**
 * Ohne diese Grenze leert React bei einem Fehler waehrend des Renderns den
 * ganzen Baum, und uebrig bleibt ein weisses Fenster ohne jeden Hinweis.
 * Der Fehler geht zusaetzlich an das Backend, damit er im Terminal steht.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, stack: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ stack: info.componentStack ?? null });
    void invoke('log_frontend', {
      level: 'render',
      message: `${error.message}\n${error.stack ?? ''}\n${info.componentStack ?? ''}`
    }).catch(() => undefined);
  }

  render() {
    const { error, stack } = this.state;
    if (error === null) return this.props.children;

    return (
      <div className='h-full w-full overflow-auto bg-background p-4 text-sm text-foreground'>
        <h1 className='mb-2 text-base font-semibold text-destructive'>
          The interface crashed
        </h1>
        <p className='mb-3 font-mono break-words'>{error.message}</p>
        <pre className='text-muted-foreground text-xs whitespace-pre-wrap'>
          {error.stack}
          {stack}
        </pre>
      </div>
    );
  }
}

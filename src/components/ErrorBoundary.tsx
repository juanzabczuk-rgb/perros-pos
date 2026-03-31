import React from 'react';
import { Utensils } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    // console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-8 text-center bg-white rounded-3xl border border-stone-100 shadow-sm">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Utensils size={32} className="text-red-500" />
          </div>
          <h2 className="text-xl font-black text-stone-900 uppercase tracking-tight mb-2">Algo salió mal</h2>
          <p className="text-stone-500 text-sm mb-6">Ocurrió un error al cargar esta sección.</p>
          <button 
            onClick={() => this.setState({ hasError: false })}
            className="bg-stone-900 text-white px-8 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-stone-900/20 active:scale-95 transition-all"
          >
            Reintentar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

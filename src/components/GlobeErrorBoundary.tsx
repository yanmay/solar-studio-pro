import React, { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback: ReactNode;
  onError?: () => void;
}

interface State {
  hasError: boolean;
}

export class GlobeErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Globe error captured by boundary:", error, errorInfo);
    this.props.onError?.();
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}
export default GlobeErrorBoundary;

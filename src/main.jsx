import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './style.css'

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error, info) { console.error('GitLarp render error:', error, info) }
  render() {
    if (this.state.error) return <pre style={{ padding: 24, whiteSpace: 'pre-wrap' }}>Something went wrong: {this.state.error.message}</pre>
    return this.props.children
  }
}

createRoot(document.getElementById('root')).render(<ErrorBoundary><App /></ErrorBoundary>)

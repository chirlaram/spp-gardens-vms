export default function LoadingOverlay({ message = 'Loading…' }) {
  return (
    <div className="loading-overlay">
      <div className="spinner" />
      <div className="loading-text">{message}</div>
    </div>
  )
}

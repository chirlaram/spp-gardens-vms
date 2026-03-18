export default function Toast({ message, type = 'success', onClose }) {
  const icons = { success: '✓', error: '✕', warning: '!' }
  return (
    <div className={`toast toast-${type}`} role="alert" aria-live="polite">
      <span>{icons[type] || '●'}</span>
      <span style={{ flex: 1 }}>{message}</span>
      <button className="toast-close" onClick={onClose} aria-label="Close">×</button>
    </div>
  )
}

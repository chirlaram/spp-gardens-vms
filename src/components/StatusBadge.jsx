const CLASS_MAP = {
  'Token Advance': 'status-token',
  'Confirmed - 50% Advance': 'status-confirmed',
  '100% Payment': 'status-full',
  'Cancelled': 'status-cancelled',
  'Completed': 'status-completed',
}

export default function StatusBadge({ status }) {
  const cls = CLASS_MAP[status] || 'status-token'
  return (
    <span className={`status-badge ${cls}`}>
      {status}
    </span>
  )
}

/**
 * Auto-calculates booking status based on payments and total.
 * Never overrides 'Cancelled' or 'Completed'.
 */
export function deriveStatus(currentStatus, payments, total) {
  if (currentStatus === 'Cancelled' || currentStatus === 'Completed') return currentStatus
  const paid = (payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0)
  const totalNum = Number(total) || 0
  if (totalNum <= 0) return 'Token Advance'
  if (paid >= totalNum) return '100% Payment'
  if (paid >= Math.round(totalNum * 0.5)) return 'Confirmed - 50% Advance'
  return 'Token Advance'
}

export const STATUS_COLORS = {
  'Token Advance': { bg: '#fff8e1', text: '#b36a00', border: '#f5c842' },
  'Confirmed - 50% Advance': { bg: '#e8f5e9', text: '#1b5e20', border: '#66bb6a' },
  '100% Payment': { bg: '#e3f2fd', text: '#0d47a1', border: '#42a5f5' },
  'Cancelled': { bg: '#fce4ec', text: '#880e4f', border: '#f48fb1' },
  'Completed': { bg: '#f3e5f5', text: '#4a148c', border: '#ab47bc' },
}

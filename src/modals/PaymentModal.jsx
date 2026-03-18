import { useState } from 'react'
import { recordPayment } from '../services/bookingService'
import { formatCurrency, todayISO, shortId } from '../utils/formatters'
import { deriveStatus } from '../utils/statusCalc'
import { downloadReceipt, viewReceipt } from '../utils/receiptGenerator'

const PAYMENT_MODES = ['cash', 'upi', 'bank_transfer', 'cheque', 'card', 'other']

export default function PaymentModal({ booking, onClose, onSuccess, user, onPatch }) {
  const payments = booking.payments || []
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount || 0), 0)
  const balance = Number(booking.total || 0) - totalPaid

  const [form, setForm] = useState({
    amount: '',
    date: todayISO(),
    mode: 'cash',
    reference: '',
    note: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // savedPayment is set after a successful payment, showing receipt buttons
  const [savedPayment, setSavedPayment] = useState(null)
  const [receiptLoading, setReceiptLoading] = useState('')

  function setField(f, v) { setForm(prev => ({ ...prev, [f]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.amount || Number(form.amount) <= 0) { setError('Enter a valid amount'); return }
    setLoading(true)
    setError('')

    const paymentAmount = Number(form.amount)
    // Optimistic: instantly recalculate status with the new payment added
    const optimisticPayments = [...(booking.payments || []), { amount: paymentAmount }]
    const optimisticStatus = deriveStatus(booking.status, optimisticPayments, booking.total)
    onPatch?.(booking.id, { status: optimisticStatus })

    try {
      const payment = await recordPayment(booking.id, {
        amount: paymentAmount,
        date: form.date,
        mode: form.mode,
        reference: form.reference.trim(),
        note: form.note.trim(),
      }, user.id)
      setSavedPayment(payment)
      onSuccess(booking.id)
    } catch (err) {
      // Rollback optimistic status update
      onPatch?.(booking.id, { status: booking.status })
      setError(err.message || 'Failed to record payment')
    } finally {
      setLoading(false)
    }
  }

  async function handleDownload() {
    setReceiptLoading('download')
    const receiptNo = shortId(savedPayment.id)
    try {
      await downloadReceipt(booking, savedPayment, receiptNo)
    } finally {
      setReceiptLoading('')
    }
  }

  async function handleView() {
    setReceiptLoading('view')
    const receiptNo = shortId(savedPayment.id)
    try {
      await viewReceipt(booking, savedPayment, receiptNo)
    } finally {
      setReceiptLoading('')
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-md">
        <div className="modal-header">
          <div className="modal-header-content">
            <div className="modal-title">Record Payment</div>
            <div className="modal-subtitle">{booking.client} — {booking.event}</div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {savedPayment ? (
          /* Post-success: show receipt buttons */
          <div className="modal-body" style={{ textAlign: 'center', padding: '40px 32px' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>✅</div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--forest)', marginBottom: 6 }}>
              Payment Recorded
            </div>
            <div style={{ color: '#555', marginBottom: 28, fontSize: '0.9rem' }}>
              {formatCurrency(savedPayment.amount)} received from {booking.client}
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                className="btn btn-gold"
                onClick={handleDownload}
                disabled={!!receiptLoading}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {receiptLoading === 'download' ? '⏳ Generating…' : '⬇ Download Receipt'}
              </button>
              <button
                className="btn btn-outline"
                onClick={handleView}
                disabled={!!receiptLoading}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {receiptLoading === 'view' ? '⏳ Loading…' : '👁 View Receipt'}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {/* Summary */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                <div className="payment-sum-card">
                  <div className="payment-sum-label">Total</div>
                  <div className="payment-sum-val">{formatCurrency(booking.total)}</div>
                </div>
                <div className="payment-sum-card">
                  <div className="payment-sum-label">Paid</div>
                  <div className="payment-sum-val" style={{ color: 'var(--grove)' }}>{formatCurrency(totalPaid)}</div>
                </div>
                <div className="payment-sum-card">
                  <div className="payment-sum-label">Balance</div>
                  <div className="payment-sum-val" style={{ color: balance > 0 ? '#e65100' : '#1b5e20' }}>{formatCurrency(balance)}</div>
                </div>
              </div>

              {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Amount (₹) *</label>
                  <input
                    className="form-control"
                    type="number"
                    value={form.amount}
                    onChange={e => setField('amount', e.target.value)}
                    placeholder="0"
                    min="1"
                    required
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Date *</label>
                  <input
                    className="form-control"
                    type="date"
                    value={form.date}
                    onChange={e => setField('date', e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Mode</label>
                  <select className="form-control" value={form.mode} onChange={e => setField('mode', e.target.value)}>
                    {PAYMENT_MODES.map(m => (
                      <option key={m} value={m}>{m.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Reference</label>
                  <input
                    className="form-control"
                    value={form.reference}
                    onChange={e => setField('reference', e.target.value)}
                    placeholder="Cheque no, UTR, etc."
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Note</label>
                <input
                  className="form-control"
                  value={form.note}
                  onChange={e => setField('note', e.target.value)}
                  placeholder="Optional note"
                />
              </div>

              {/* Payment History */}
              {payments.length > 0 && (
                <div className="payment-history">
                  <div className="payment-history-title">Previous Payments</div>
                  {payments.map(p => (
                    <div key={p.id} className="payment-history-item">
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--grove)', fontSize: '1rem' }}>{formatCurrency(p.amount)}</div>
                        <div className="payment-meta">
                          {p.date} · {p.mode}{p.reference ? ` · ${p.reference}` : ''}
                        </div>
                        {p.note && <div className="payment-meta">{p.note}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-gold" disabled={loading}>
                {loading ? 'Recording…' : 'Record Payment'}
              </button>
            </div>
          </form>
        )}

        {savedPayment && (
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  )
}

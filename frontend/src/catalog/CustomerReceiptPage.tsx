import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getApiErrorMessage } from '../services/apiError'
import { formatCurrency, formatPaymentStatus, getCustomerReceipt } from '../services/catalog'
import type { PaymentReceipt } from '../services/catalog'

function formatReceiptDate(value: string): string {
  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Lagos',
  }).format(new Date(value))
}

export function CustomerReceiptPage() {
  const { bookingId } = useParams()
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const id = Number(bookingId)
    if (!Number.isSafeInteger(id) || id < 1) {
      setError('Invalid booking reference.')
      setLoading(false)
      return
    }

    getCustomerReceipt(id)
      .then((result) => {
        if (active) setReceipt(result)
      })
      .catch((requestError: unknown) => {
        if (active) setError(getApiErrorMessage(requestError))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [bookingId])

  return (
    <main className="page receipt-page">
      <section className="welcome-card receipt-card" aria-labelledby="receipt-title">
        <header className="receipt-header">
          <Link className="brand-link" to="/">BookEase</Link>
          <Link className="secondary-button receipt-back" to="/customer">Back to bookings</Link>
        </header>
        {loading && <p role="status">Loading your receipt…</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {receipt && (
          <>
            <div className="receipt-success">
              <p className="eyebrow">PAYMENT SUCCESSFUL</p>
              <h1 id="receipt-title">Your receipt</h1>
              <p>Payment verified by Paystack and booking confirmed.</p>
            </div>
            <div className="receipt-number">
              <span>Receipt number</span>
              <strong>{receipt.receipt_number}</strong>
            </div>
            <div className="receipt-total">
              <span>Total paid</span>
              <strong>{formatCurrency(receipt.amount_minor / 100)}</strong>
              <span className={`customer-booking-status customer-booking-status--${receipt.payment_status === 'refunded' || receipt.payment_status === 'refund_failed' ? 'cancelled' : receipt.payment_status === 'paid' || receipt.payment_status === 'succeeded' ? 'confirmed' : 'pending'}`}>
                {formatPaymentStatus(receipt.payment_status)}
              </span>
            </div>
            <div className="receipt-details">
              <section>
                <h2>Service and booking</h2>
                <dl>
                  <div><dt>Service</dt><dd>{receipt.service_name}</dd></div>
                  <div><dt>Booking number</dt><dd>#{receipt.booking_id}</dd></div>
                  <div><dt>Appointment</dt><dd>{formatReceiptDate(receipt.booking_starts_at)}</dd></div>
                  <div><dt>Vendor</dt><dd>{receipt.vendor_name}</dd></div>
                  {receipt.vendor_phone && <div><dt>Vendor phone</dt><dd>{receipt.vendor_phone}</dd></div>}
                  {receipt.vendor_location && <div><dt>Location</dt><dd>{receipt.vendor_location}</dd></div>}
                </dl>
              </section>
              <section>
                <h2>Customer and payment</h2>
                <dl>
                  <div><dt>Customer</dt><dd>{receipt.customer_name}</dd></div>
                  {receipt.customer_email && <div><dt>Email</dt><dd>{receipt.customer_email}</dd></div>}
                  <div><dt>Payment date</dt><dd>{formatReceiptDate(receipt.issued_at)} WAT</dd></div>
                  <div><dt>Provider</dt><dd>Paystack</dd></div>
                  <div><dt>Payment reference</dt><dd>{receipt.payment_reference}</dd></div>
                  {receipt.transaction_id && <div><dt>Transaction ID</dt><dd>{receipt.transaction_id}</dd></div>}
                  <div><dt>Payment channel</dt><dd>{receipt.payment_method ?? 'Paystack checkout'}</dd></div>
                </dl>
              </section>
            </div>
            <div className="form-actions receipt-actions no-print">
              <a
                className="auth-link auth-link--primary"
                href={`/api/v1/customer/bookings/${receipt.booking_id}/receipt.pdf`}
                download={`bookease-receipt-${receipt.receipt_number}.pdf`}
              >
                Download PDF
              </a>
              <button className="secondary-button" type="button" onClick={() => window.print()}>
                Print receipt
              </button>
            </div>
            <p className="receipt-thanks">Thank you for booking with BookEase. Keep this receipt for your records.</p>
          </>
        )}
      </section>
    </main>
  )
}

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Payment receipt {{ $receipt['receipt_number'] }}</title>
    <style>
        @page { margin: 10px; }
        body { color: #26352d; font: 9px DejaVu Sans, sans-serif; line-height: 1.35; }
        .receipt { margin: 0 auto; width: 100%; }
        .brand { color: #24714f; font-size: 16px; font-weight: bold; }
        h1 { margin: 12px 0 3px; font-size: 16px; }
        .muted { color: #69766e; }
        .paid { color: #24714f; font-weight: bold; text-transform: uppercase; }
        table { border-collapse: collapse; margin-top: 12px; width: 100%; }
        th, td { border-bottom: 1px dashed #cbd4cb; padding: 5px 2px; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
        th { color: #69766e; font-size: 8px; text-transform: uppercase; width: 34%; }
        .total { font-size: 13px; font-weight: bold; }
        footer { border-top: 1px dashed #cbd4cb; margin-top: 16px; padding-top: 8px; }
    </style>
</head>
<body>
<main class="receipt">
    <div class="brand">BookEase</div>
    <h1>Payment receipt</h1>
    <div class="muted">Receipt {{ $receipt['receipt_number'] }}</div>
    <p class="paid">Payment {{ str_replace('_', ' ', $receipt['payment_status']) }}</p>

    <table>
        <tr><th>Service</th><td>{{ $receipt['service_name'] }}</td></tr>
        <tr><th>Booking</th><td>#{{ $receipt['booking_id'] }}<br>{{ \Illuminate\Support\Carbon::parse($receipt['booking_starts_at'])->setTimezone('Africa/Lagos')->format('D, j M Y · g:i A') }}</td></tr>
        <tr><th>Customer</th><td>{{ $receipt['customer_name'] }}<br>{{ $receipt['customer_email'] }}</td></tr>
        <tr><th>Vendor</th><td>{{ $receipt['vendor_name'] }}<br>{{ $receipt['vendor_phone'] }}<br>{{ $receipt['vendor_location'] }}</td></tr>
        <tr><th>Payment date</th><td>{{ $receipt['issued_at']->setTimezone('Africa/Lagos')->format('D, j M Y · g:i A') }} WAT</td></tr>
        <tr><th>Payment provider</th><td>Paystack</td></tr>
        <tr><th>Payment reference</th><td>{{ $receipt['payment_reference'] }}</td></tr>
        <tr><th>Transaction ID</th><td>{{ $receipt['transaction_id'] }}</td></tr>
        <tr><th>Payment channel</th><td>{{ $receipt['payment_method'] ?? 'Paystack checkout' }}</td></tr>
        <tr><th>Total paid</th><td class="total">₦{{ number_format($receipt['amount_minor'] / 100, 2) }}</td></tr>
    </table>

    <footer class="muted">Thank you for booking with BookEase. Keep this receipt for your records.</footer>
</main>
</body>
</html>

<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Payment;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ReceiptController extends Controller
{
    public function show(Request $request, Booking $booking): JsonResponse
    {
        $payment = $this->receiptPayment($request, $booking);

        return response()->json([
            'data' => [
                'receipt_number' => $payment->receipt_number,
                'issued_at' => $payment->receipt_issued_at?->toIso8601String(),
                'payment_status' => $payment->status === 'succeeded' ? 'paid' : $payment->status,
                ...$payment->receipt_data,
            ],
        ]);
    }

    public function download(Request $request, Booking $booking): Response
    {
        $payment = $this->receiptPayment($request, $booking);
        $receipt = [
            'receipt_number' => $payment->receipt_number,
            'issued_at' => $payment->receipt_issued_at,
            'payment_status' => $payment->status === 'succeeded' ? 'paid' : $payment->status,
            ...$payment->receipt_data,
        ];
        $paperHeight = $this->paperHeight($receipt);

        return Pdf::loadView('receipts.payment', ['receipt' => $receipt])
            ->setPaper([0, 0, 226.77, $paperHeight])
            ->download('bookease-receipt-'.$payment->receipt_number.'.pdf');
    }

    private function paperHeight(array $receipt): float
    {
        $values = [
            $receipt['receipt_number'],
            $receipt['service_name'],
            '#'.$receipt['booking_id'].' '.$receipt['booking_starts_at'],
            $receipt['customer_name'],
            $receipt['customer_email'],
            $receipt['vendor_name'],
            $receipt['vendor_phone'],
            $receipt['vendor_location'],
            $receipt['payment_reference'],
            $receipt['transaction_id'],
            $receipt['payment_method'],
        ];
        $contentLines = array_sum(array_map(
            fn (mixed $value): int => $value === null || $value === ''
                ? 0
                : max(1, (int) ceil(mb_strlen((string) $value) / 30)),
            $values,
        ));

        return min(1600, max(420, 270 + $contentLines * 18));
    }

    private function receiptPayment(Request $request, Booking $booking): Payment
    {
        $customerBooking = $request->user()->bookings()->findOrFail($booking->id);

        return $customerBooking->payments()
            ->whereNotNull('receipt_number')
            ->whereNotNull('receipt_data')
            ->latest('receipt_issued_at')
            ->firstOrFail();
    }
}

<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Services\PaystackPaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PaymentController extends Controller
{
    public function verifyCustomerPayment(
        Request $request,
        Booking $booking,
        PaystackPaymentService $payments,
    ): JsonResponse {
        $validated = $request->validate([
            'reference' => ['required', 'string', 'max:100'],
        ]);
        $customerBooking = $request->user()->bookings()->findOrFail($booking->id);
        $payment = $payments->verifyCustomerPayment($customerBooking, $validated['reference']);
        $customerBooking->refresh();

        return response()->json([
            'data' => [
                'payment_status' => $payment->status === 'succeeded' ? 'paid' : $payment->status,
                'booking_status' => $customerBooking->status->value,
                'receipt_number' => $payment->receipt_number,
            ],
        ]);
    }
}

<?php

namespace App\Services;

use App\Enums\BookingStatus;
use App\Models\Booking;
use App\Models\Payment;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\HttpException;

class PaystackPaymentService
{
    public function createCheckoutSession(Booking $booking): array
    {
        $secret = (string) config('services.paystack.secret_key');
        if ($secret === '') {
            $booking->update(['status' => BookingStatus::REJECTED]);

            throw new HttpException(503, 'Payments are not configured. Please contact support.');
        }

        [$whole, $fraction] = array_pad(explode('.', (string) $booking->price, 2), 2, '00');
        $amount = ((int) $whole * 100) + (int) str_pad(substr($fraction, 0, 2), 2, '0');
        $reference = 'bookease_'.Str::uuid()->toString();
        $payment = $booking->payments()->create([
            'provider' => 'paystack',
            'status' => 'pending',
            'amount' => $amount,
            'currency' => 'NGN',
            'provider_reference' => $reference,
        ]);

        try {
            $response = $this->request('post', '/transaction/initialize', [
                'email' => $booking->customer->email,
                'amount' => (string) $amount,
                'currency' => 'NGN',
                'reference' => $reference,
                'callback_url' => rtrim((string) config('services.paystack.frontend_url'), '/').'/customer?payment=success',
                'metadata' => [
                    'booking_id' => $booking->id,
                    'payment_id' => $payment->id,
                ],
            ]);
        } catch (HttpException $exception) {
            $payment->update(['status' => 'failed']);
            $booking->update(['status' => BookingStatus::REJECTED]);

            throw $exception;
        }

        $checkoutUrl = $response['data']['authorization_url'] ?? null;
        if (! is_string($checkoutUrl) || ($response['data']['reference'] ?? null) !== $reference) {
            $payment->update(['status' => 'failed']);
            $booking->update(['status' => BookingStatus::REJECTED]);
            Log::error('Paystack returned an invalid transaction initialization response.', [
                'payment_id' => $payment->id,
            ]);

            throw new HttpException(502, 'The payment provider returned an invalid checkout response.');
        }

        return [
            'checkout_url' => $checkoutUrl,
            'payment_status' => $payment->status,
        ];
    }

    public function verifyWebhookSignature(string $payload, ?string $signature): bool
    {
        $secret = (string) config('services.paystack.secret_key');
        if ($secret === '' || ! $signature) {
            return false;
        }

        return hash_equals(hash_hmac('sha512', $payload, $secret), $signature);
    }

    public function processWebhook(array $event): void
    {
        $type = $event['event'] ?? null;
        $data = $event['data'] ?? [];

        if ($type === 'charge.success') {
            $reference = $data['reference'] ?? null;
            $payment = is_string($reference)
                ? Payment::query()->with('booking')->where('provider', 'paystack')
                    ->where('provider_reference', $reference)->first()
                : null;

            if (! $payment) {
                Log::warning('Ignoring Paystack success event for an unknown payment.', [
                    'reference' => $reference,
                ]);

                return;
            }

            $verified = $this->request('get', '/transaction/verify/'.rawurlencode($reference));
            $transaction = $verified['data'] ?? [];
            if (($verified['status'] ?? false) !== true
                || ($transaction['status'] ?? null) !== 'success'
                || ($transaction['reference'] ?? null) !== $payment->provider_reference
                || (int) ($transaction['amount'] ?? 0) !== $payment->amount
                || ($transaction['currency'] ?? null) !== $payment->currency) {
                Log::error('Paystack transaction verification did not match the expected payment.', [
                    'payment_id' => $payment->id,
                ]);

                return;
            }

            if (! in_array($payment->status, ['refunded', 'refund_pending'], true)) {
                $payment->update([
                    'status' => 'succeeded',
                    'transaction_id' => isset($transaction['id']) ? (string) $transaction['id'] : null,
                ]);
            }

            if (in_array($payment->booking->status, [BookingStatus::CANCELLED, BookingStatus::REJECTED], true)) {
                $this->refundBooking($payment->booking);
            }

            return;
        }

        if (in_array($type, ['refund.processed', 'refund.failed'], true)) {
            $reference = $data['transaction']['reference'] ?? $data['reference'] ?? null;
            $transactionId = $data['transaction']['id'] ?? null;
            if (! is_string($reference) && ! is_numeric($transactionId)) {
                Log::warning('Ignoring Paystack refund event without a transaction reference.', [
                    'event' => $type,
                ]);

                return;
            }

            $payment = Payment::query()->where('provider', 'paystack')
                ->where(function ($query) use ($reference, $transactionId): void {
                    if (is_string($reference)) {
                        $query->where('provider_reference', $reference);
                    }
                    if (is_numeric($transactionId)) {
                        $query->orWhere('transaction_id', (string) $transactionId);
                    }
                })->first();
            if ($payment && $payment->status === 'refund_pending') {
                $payment->update([
                    'status' => $type === 'refund.processed' ? 'refunded' : 'refund_failed',
                    'refund_id' => isset($data['id']) ? (string) $data['id'] : $payment->refund_id,
                ]);
            }
        }
    }

    public function refundBooking(Booking $booking): void
    {
        $payments = $booking->payments()
            ->where('provider', 'paystack')
            ->whereIn('status', ['succeeded', 'refund_failed'])
            ->get();

        foreach ($payments as $payment) {
            if (! $payment->provider_reference) {
                throw new HttpException(502, 'A paid booking is missing its payment reference; contact support.');
            }

            $claimed = Payment::query()->whereKey($payment->id)
                ->whereIn('status', ['succeeded', 'refund_failed'])
                ->update(['status' => 'refund_pending']);
            if ($claimed === 0) {
                continue;
            }

            try {
                $response = $this->request('post', '/refund', [
                    'transaction' => $payment->provider_reference,
                ]);
            } catch (HttpException $exception) {
                Payment::query()->whereKey($payment->id)
                    ->where('status', 'refund_pending')
                    ->update(['status' => $payment->status]);

                throw $exception;
            }
            $data = $response['data'] ?? [];
            if (($response['status'] ?? false) !== true || ! isset($data['id'])) {
                Payment::query()->whereKey($payment->id)
                    ->where('status', 'refund_pending')
                    ->update(['status' => 'refund_failed']);
                Log::error('Paystack returned an invalid refund response.', ['payment_id' => $payment->id]);

                throw new HttpException(502, 'The payment provider returned an invalid refund response.');
            }

            Payment::query()->whereKey($payment->id)->where('status', 'refund_pending')
                ->update([
                    'status' => ($data['status'] ?? null) === 'processed' ? 'refunded' : 'refund_pending',
                    'refund_id' => (string) $data['id'],
                ]);
        }
    }

    private function request(string $method, string $path, array $data = []): array
    {
        $secret = (string) config('services.paystack.secret_key');
        if ($secret === '') {
            throw new HttpException(503, 'Payments are not configured. Please contact support.');
        }

        try {
            $request = Http::withToken($secret)
                ->acceptJson()
                ->timeout(15);
            $response = $method === 'get'
                ? $request->get('https://api.paystack.co'.$path)
                : $request->post('https://api.paystack.co'.$path, $data);
        } catch (ConnectionException $exception) {
            Log::error('Unable to connect to Paystack.', ['path' => $path]);

            throw new HttpException(502, 'The payment provider is unavailable. Please try again.', $exception);
        }

        $this->ensureSuccessful($response);

        return $response->json() ?? [];
    }

    private function ensureSuccessful(Response $response): void
    {
        if ($response->successful() && $response->json('status') === true) {
            return;
        }

        if ($response->status() === 401) {
            Log::error('Paystack rejected the configured secret key.', [
                'status' => $response->status(),
            ]);

            throw new HttpException(
                502,
                'Paystack rejected the configured secret key. Check PAYSTACK_SECRET_KEY in backend/.env and restart the API.',
            );
        }

        Log::error('Paystack API request failed.', [
            'status' => $response->status(),
            'message' => $response->json('message'),
        ]);

        throw new HttpException(502, 'The payment provider could not process this request. Please try again.');
    }
}

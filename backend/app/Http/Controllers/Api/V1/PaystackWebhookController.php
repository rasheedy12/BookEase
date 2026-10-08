<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\PaystackPaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class PaystackWebhookController extends Controller
{
    public function __invoke(Request $request, PaystackPaymentService $payments): JsonResponse
    {
        if (! config('services.paystack.secret_key')) {
            abort(503, 'Paystack webhooks are not configured.');
        }

        $payload = $request->getContent();
        if (! $payments->verifyWebhookSignature($payload, $request->header('x-paystack-signature'))) {
            abort(400, 'Invalid Paystack webhook signature.');
        }

        $event = json_decode($payload, true);
        if (! is_array($event) || ! is_string($event['event'] ?? null)) {
            abort(400, 'Invalid Paystack webhook payload.');
        }

        Log::info('Received Paystack webhook.', [
            'event' => $event['event'],
            'reference' => $event['data']['reference'] ?? null,
        ]);
        $payments->processWebhook($event);

        return response()->json(['received' => true]);
    }
}

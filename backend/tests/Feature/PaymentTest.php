<?php

namespace Tests\Feature;

use App\Enums\BookingStatus;
use App\Enums\UserRole;
use App\Models\Booking;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as ClientRequest;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class PaymentTest extends TestCase
{
    use RefreshDatabase;

    private int $verifiedAmount = 8500;

    protected function setUp(): void
    {
        parent::setUp();
        config([
            'services.paystack.secret_key' => 'sk_test_bookease',
            'services.paystack.frontend_url' => 'http://localhost:5173',
        ]);
        Http::fake(function (ClientRequest $request) {
            if (str_ends_with($request->url(), '/transaction/verify/BE_test_reference')) {
                return Http::response([
                    'status' => true,
                    'data' => [
                        'status' => 'success',
                        'reference' => 'BE_test_reference',
                        'amount' => $this->verifiedAmount,
                        'currency' => 'NGN',
                        'id' => 123456,
                    ],
                ]);
            }

            if (str_ends_with($request->url(), '/refund')) {
                return Http::response([
                    'status' => true,
                    'data' => ['id' => 98765, 'status' => 'processing'],
                ]);
            }

            return Http::response(['status' => true, 'data' => []]);
        });
    }

    public function test_signed_success_webhook_verifies_payment_and_cancellation_starts_refund(): void
    {
        [$customer, $booking, $payment] = $this->makePendingPayment();
        $this->sendSignedWebhook([
            'event' => 'charge.success',
            'data' => ['reference' => $payment->provider_reference],
        ])->assertOk()->assertJsonPath('received', true);

        $this->assertDatabaseHas('payments', [
            'id' => $payment->id,
            'status' => 'succeeded',
            'transaction_id' => '123456',
            'currency' => 'NGN',
        ]);
        $booking->refresh();
        $payment->refresh();
        $this->assertSame(BookingStatus::CONFIRMED, $booking->status);
        $this->assertNotNull($payment->receipt_number);
        $this->assertSame($customer->name, $payment->receipt_data['customer_name']);
        $this->assertSame('Portrait session', $payment->receipt_data['service_name']);

        $this->actingAs($customer, 'sanctum')
            ->getJson("/api/v1/customer/bookings/{$booking->id}/receipt")
            ->assertOk()
            ->assertJsonPath('data.receipt_number', $payment->receipt_number)
            ->assertJsonPath('data.customer_email', $customer->email)
            ->assertJsonPath('data.vendor_name', 'Bright Studio')
            ->assertJsonPath('data.transaction_id', '123456');
        $this->get("/api/v1/customer/bookings/{$booking->id}/receipt.pdf")
            ->assertOk()
            ->assertHeader('content-type', 'application/pdf');

        $this->patchJson("/api/v1/customer/bookings/{$booking->id}/status", ['status' => 'cancelled'])
            ->assertOk()
            ->assertJsonPath('data.status', 'cancelled')
            ->assertJsonPath('data.payment_status', 'refund_pending');

        $this->assertDatabaseHas('payments', [
            'id' => $payment->id,
            'status' => 'refund_pending',
            'refund_id' => '98765',
        ]);
        Http::assertSent(fn (ClientRequest $request) => str_ends_with($request->url(), '/refund')
            && $request->data()['transaction'] === 'BE_test_reference');

        $this->sendSignedWebhook([
            'event' => 'refund.processed',
            'data' => [
                'id' => 98765,
                'reference' => 'BE_test_reference',
            ],
        ])->assertOk();

        $this->assertDatabaseHas('payments', ['id' => $payment->id, 'status' => 'refunded']);
    }

    public function test_success_webhook_does_not_mark_unverified_amount_as_paid(): void
    {
        [, , $payment] = $this->makePendingPayment();
        $this->verifiedAmount = 1;

        $this->sendSignedWebhook([
            'event' => 'charge.success',
            'data' => ['reference' => $payment->provider_reference],
        ])->assertOk();

        $this->assertDatabaseHas('payments', ['id' => $payment->id, 'status' => 'pending']);
    }

    public function test_failed_refund_webhook_exposes_failed_refund_status(): void
    {
        [, , $payment] = $this->makePendingPayment();
        $payment->update([
            'status' => 'refund_pending',
            'transaction_id' => '123456',
        ]);

        $this->sendSignedWebhook([
            'event' => 'refund.failed',
            'data' => [
                'id' => 98765,
                'transaction' => ['id' => 123456, 'reference' => 'BE_test_reference'],
            ],
        ])->assertOk();

        $this->assertDatabaseHas('payments', ['id' => $payment->id, 'status' => 'refund_failed']);
    }

    public function test_invalid_webhook_signature_is_rejected(): void
    {
        $this->call(
            'POST',
            '/api/v1/payments/paystack/webhook',
            [],
            [],
            [],
            ['CONTENT_TYPE' => 'application/json', 'HTTP_X_PAYSTACK_SIGNATURE' => 'invalid'],
            '{"event":"charge.success"}',
        )->assertBadRequest();
    }

    public function test_customer_can_verify_payment_after_paystack_redirect(): void
    {
        [$customer, $booking, $payment] = $this->makePendingPayment();

        $this->actingAs($customer, 'sanctum')
            ->postJson("/api/v1/customer/bookings/{$booking->id}/payment/verify", [
                'reference' => $payment->provider_reference,
            ])
            ->assertOk()
            ->assertJsonPath('data.payment_status', 'paid')
            ->assertJsonPath('data.booking_status', 'confirmed');

        $this->assertNotNull($payment->fresh()->receipt_number);
    }

    public function test_another_customer_cannot_view_a_receipt(): void
    {
        [, $booking, $payment] = $this->makePendingPayment();
        $payment->update([
            'status' => 'succeeded',
            'receipt_number' => 'BE-20261008-TEST',
            'receipt_issued_at' => now(),
            'receipt_data' => ['service_name' => 'Portrait session'],
        ]);
        $otherCustomer = User::factory()->create(['role' => UserRole::CUSTOMER]);

        $this->actingAs($otherCustomer, 'sanctum')
            ->getJson("/api/v1/customer/bookings/{$booking->id}/receipt")
            ->assertNotFound();
    }

    /**
     * @return array{User, Booking, Payment}
     */
    private function makePendingPayment(): array
    {
        $vendor = User::factory()->create(['role' => UserRole::VENDOR]);
        $profile = $vendor->vendorProfile()->create(['business_name' => 'Bright Studio']);
        $service = $profile->services()->create([
            'name' => 'Portrait session',
            'description' => 'A portrait session.',
            'category' => 'Photography',
            'duration_minutes' => 60,
            'price' => 85,
            'is_active' => true,
        ]);
        $customer = User::factory()->create(['role' => UserRole::CUSTOMER]);
        $booking = Booking::create([
            'customer_id' => $customer->id,
            'vendor_profile_id' => $profile->id,
            'service_id' => $service->id,
            'service_name' => $service->name,
            'business_name' => $profile->business_name,
            'starts_at' => now()->addDays(2),
            'ends_at' => now()->addDays(2)->addHour(),
            'price' => $service->price,
            'status' => BookingStatus::PENDING,
        ]);
        $payment = $booking->payments()->create([
            'provider' => 'paystack',
            'status' => 'pending',
            'amount' => 8500,
            'currency' => 'NGN',
            'provider_reference' => 'BE_test_reference',
        ]);

        return [$customer, $booking, $payment];
    }

    private function sendSignedWebhook(array $event)
    {
        $payload = json_encode($event, JSON_THROW_ON_ERROR);
        $signature = hash_hmac('sha512', $payload, 'sk_test_bookease');

        return $this->call(
            'POST',
            '/api/v1/payments/paystack/webhook',
            [],
            [],
            [],
            [
                'CONTENT_TYPE' => 'application/json',
                'HTTP_X_PAYSTACK_SIGNATURE' => $signature,
            ],
            $payload,
        );
    }
}

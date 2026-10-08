<?php

namespace Tests\Feature;

use App\Enums\BookingStatus;
use App\Enums\UserRole;
use App\Models\Service;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as ClientRequest;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class BookingTest extends TestCase
{
    use RefreshDatabase;

    private bool $rejectPaystackKey = false;

    protected function setUp(): void
    {
        parent::setUp();
        config([
            'services.paystack.secret_key' => 'sk_test_bookease',
            'services.paystack.frontend_url' => 'http://localhost:5173',
        ]);
        $session = 0;
        Http::fake(function (ClientRequest $request) use (&$session) {
            if ($this->rejectPaystackKey && str_ends_with($request->url(), '/transaction/initialize')) {
                return Http::response(['status' => false, 'message' => 'Invalid key'], 401);
            }

            if (str_ends_with($request->url(), '/transaction/initialize')) {
                $session++;

                return Http::response([
                    'status' => true,
                    'data' => [
                        'reference' => $request->data()['reference'],
                        'authorization_url' => "https://checkout.paystack.test/session/{$session}",
                    ],
                ]);
            }

            return Http::response(['status' => true, 'data' => ['id' => 're_test_1']]);
        });
    }

    public function test_customer_can_request_booking_and_vendor_can_manage_its_lifecycle(): void
    {
        [$customer, $vendor, $service] = $this->makeServiceOffering();
        $startsAt = now()->addDays(2)->startOfDay()->addHours(12)->toIso8601String();

        $this->actingAs($customer, 'sanctum')
            ->postJson('/api/v1/customer/bookings', [
                'service_id' => $service->id,
                'starts_at' => $startsAt,
                'notes' => 'Please call on arrival.',
            ])
            ->assertCreated()
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.payment_status', 'pending')
            ->assertJsonPath('checkout_url', 'https://checkout.paystack.test/session/1')
            ->assertJsonPath('data.service_name', 'Portrait session')
            ->assertJsonPath('data.price', '85.00');

        $bookingId = $customer->bookings()->firstOrFail()->id;
        $this->assertDatabaseHas('payments', [
            'booking_id' => $bookingId,
            'amount' => 8500,
            'currency' => 'NGN',
            'status' => 'pending',
        ]);
        Http::assertSent(fn (ClientRequest $request) => str_ends_with($request->url(), '/transaction/initialize')
            && (int) $request->data()['amount'] === 8500
            && $request->data()['currency'] === 'NGN'
            && $request->data()['metadata']['booking_id'] === $bookingId);

        $this->actingAs($customer, 'sanctum')
            ->postJson('/api/v1/customer/bookings', [
                'service_id' => $service->id,
                'starts_at' => $startsAt,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('starts_at');

        $this->actingAs($vendor, 'sanctum')
            ->getJson('/api/v1/vendor/bookings')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.customer_name', $customer->name);

        $this->actingAs($vendor, 'sanctum')
            ->patchJson("/api/v1/vendor/bookings/{$bookingId}/status", ['status' => 'confirmed'])
            ->assertOk()
            ->assertJsonPath('data.status', 'confirmed');

        $this->actingAs($customer, 'sanctum')
            ->patchJson("/api/v1/customer/bookings/{$bookingId}/status", ['status' => 'cancelled'])
            ->assertOk()
            ->assertJsonPath('data.status', 'cancelled');
    }

    public function test_customers_cannot_book_other_vendors_services_or_change_booking_status(): void
    {
        [$customer, $vendor, $service] = $this->makeServiceOffering();
        $otherCustomer = User::factory()->create(['role' => UserRole::CUSTOMER]);
        $otherVendor = User::factory()->create(['role' => UserRole::VENDOR]);
        $startsAt = now()->addDays(3)->startOfDay()->addHours(12)->toIso8601String();

        $this->actingAs($customer, 'sanctum')
            ->postJson('/api/v1/customer/bookings', [
                'service_id' => $service->id,
                'starts_at' => $startsAt,
            ])
            ->assertCreated();

        $bookingId = $customer->bookings()->firstOrFail()->id;

        $this->actingAs($otherVendor, 'sanctum')
            ->patchJson("/api/v1/vendor/bookings/{$bookingId}/status", ['status' => 'confirmed'])
            ->assertNotFound();

        $this->actingAs($otherCustomer, 'sanctum')
            ->patchJson("/api/v1/customer/bookings/{$bookingId}/status", ['status' => 'cancelled'])
            ->assertNotFound();

        $this->actingAs($customer, 'sanctum')
            ->patchJson("/api/v1/customer/bookings/{$bookingId}/status", ['status' => 'confirmed'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('status');
    }

    public function test_rejected_booking_does_not_block_the_time_slot(): void
    {
        [$customer, $vendor, $service] = $this->makeServiceOffering();
        $startsAt = now()->addDays(2)->startOfDay()->addHours(12)->toIso8601String();

        $this->actingAs($customer, 'sanctum')
            ->postJson('/api/v1/customer/bookings', [
                'service_id' => $service->id,
                'starts_at' => $startsAt,
            ])
            ->assertCreated();

        $bookingId = $customer->bookings()->firstOrFail()->id;
        $this->actingAs($vendor, 'sanctum')
            ->patchJson("/api/v1/vendor/bookings/{$bookingId}/status", ['status' => BookingStatus::REJECTED->value])
            ->assertOk();

        $anotherCustomer = User::factory()->create(['role' => UserRole::CUSTOMER]);
        $this->actingAs($anotherCustomer, 'sanctum')
            ->postJson('/api/v1/customer/bookings', [
                'service_id' => $service->id,
                'starts_at' => $startsAt,
            ])
            ->assertCreated();
    }

    public function test_booking_is_rejected_when_paystack_is_not_configured(): void
    {
        [$customer, , $service] = $this->makeServiceOffering();
        config(['services.paystack.secret_key' => '']);
        $startsAt = now()->addDays(2)->startOfDay()->addHours(12)->toIso8601String();

        $this->actingAs($customer, 'sanctum')
            ->postJson('/api/v1/customer/bookings', [
                'service_id' => $service->id,
                'starts_at' => $startsAt,
            ])
            ->assertStatus(503);

        $booking = $customer->bookings()->firstOrFail();
        $this->assertSame(BookingStatus::REJECTED, $booking->status);
        $this->assertDatabaseMissing('payments', ['booking_id' => $booking->id]);
    }

    public function test_booking_reports_a_rejected_paystack_secret_key(): void
    {
        [$customer, , $service] = $this->makeServiceOffering();
        $this->rejectPaystackKey = true;
        $startsAt = now()->addDays(2)->startOfDay()->addHours(12)->toIso8601String();

        $this->actingAs($customer, 'sanctum')
            ->postJson('/api/v1/customer/bookings', [
                'service_id' => $service->id,
                'starts_at' => $startsAt,
            ])
            ->assertStatus(502)
            ->assertJsonPath(
                'message',
                'Paystack rejected the configured secret key. Check PAYSTACK_SECRET_KEY in backend/.env and restart the API.',
            );

        $booking = $customer->bookings()->firstOrFail();
        $this->assertSame(BookingStatus::REJECTED, $booking->status);
        $this->assertDatabaseHas('payments', [
            'booking_id' => $booking->id,
            'status' => 'failed',
        ]);
    }

    public function test_booking_must_fit_vendor_opening_hours(): void
    {
        [$customer, , $service] = $this->makeServiceOffering();
        $startsAt = now()->addDays(2)->startOfDay()->addHours(12);
        $day = $startsAt->dayOfWeek;
        $profile = $service->vendorProfile;
        $profile->openingHours()->updateOrCreate(
            ['day_of_week' => $day],
            [
                'is_closed' => false,
                'opens_at' => '13:00',
                'closes_at' => '15:00',
            ],
        );

        $this->actingAs($customer, 'sanctum')
            ->postJson('/api/v1/customer/bookings', [
                'service_id' => $service->id,
                'starts_at' => $startsAt->toIso8601String(),
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('starts_at');

        $profile->openingHours()->where('day_of_week', $day)->update([
            'opens_at' => '12:00',
            'closes_at' => '13:00',
        ]);

        $this->postJson('/api/v1/customer/bookings', [
            'service_id' => $service->id,
            'starts_at' => $startsAt->toIso8601String(),
        ])
            ->assertCreated()
            ->assertJsonPath('data.starts_at', $startsAt->toIso8601String());
    }

    /**
     * @return array{User, User, Service}
     */
    private function makeServiceOffering(): array
    {
        $vendor = User::factory()->create(['role' => UserRole::VENDOR]);
        $profile = $vendor->vendorProfile()->create([
            'business_name' => 'Bright Studio',
            'location' => 'Downtown',
            'timezone' => 'UTC',
        ]);
        $profile->openingHours()->createMany(collect(range(0, 6))->map(fn (int $day) => [
            'day_of_week' => $day,
            'is_closed' => false,
            'opens_at' => '00:00',
            'closes_at' => '23:59',
        ])->all());
        $service = $profile->services()->create([
            'name' => 'Portrait session',
            'description' => 'A one-hour portrait session.',
            'category' => 'Photography',
            'duration_minutes' => 60,
            'price' => 85,
            'is_active' => true,
        ]);
        $customer = User::factory()->create(['role' => UserRole::CUSTOMER]);

        return [$customer, $vendor, $service];
    }
}

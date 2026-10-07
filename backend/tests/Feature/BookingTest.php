<?php

namespace Tests\Feature;

use App\Enums\BookingStatus;
use App\Enums\UserRole;
use App\Models\Service;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BookingTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_can_request_booking_and_vendor_can_manage_its_lifecycle(): void
    {
        [$customer, $vendor, $service] = $this->makeServiceOffering();
        $startsAt = now()->addDays(2)->startOfHour()->toIso8601String();

        $this->actingAs($customer, 'sanctum')
            ->postJson('/api/v1/customer/bookings', [
                'service_id' => $service->id,
                'starts_at' => $startsAt,
                'notes' => 'Please call on arrival.',
            ])
            ->assertCreated()
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.service_name', 'Portrait session')
            ->assertJsonPath('data.price', '85.00');

        $bookingId = $customer->bookings()->firstOrFail()->id;

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
        $startsAt = now()->addDays(3)->toIso8601String();

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
        $startsAt = now()->addDays(2)->startOfHour()->toIso8601String();

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

    /**
     * @return array{User, User, Service}
     */
    private function makeServiceOffering(): array
    {
        $vendor = User::factory()->create(['role' => UserRole::VENDOR]);
        $profile = $vendor->vendorProfile()->create([
            'business_name' => 'Bright Studio',
            'location' => 'Downtown',
        ]);
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

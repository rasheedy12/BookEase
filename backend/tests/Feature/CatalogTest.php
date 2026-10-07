<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CatalogTest extends TestCase
{
    use RefreshDatabase;

    public function test_vendor_can_publish_and_manage_services_for_public_discovery(): void
    {
        $vendor = User::factory()->create(['role' => UserRole::VENDOR]);
        $this->actingAs($vendor, 'sanctum');

        $this->putJson('/api/v1/vendor/profile', [
            'business_name' => 'Bright Studio',
            'description' => 'Creative services',
            'phone' => '555-0100',
            'location' => 'Downtown',
            'timezone' => 'Europe/London',
        ])
            ->assertOk()
            ->assertJsonPath('data.business_name', 'Bright Studio')
            ->assertJsonPath('data.timezone', 'Europe/London');

        $days = collect(range(0, 6))->map(fn (int $day) => [
            'day_of_week' => $day,
            'is_closed' => $day === 0,
            'opens_at' => $day === 0 ? null : '09:00',
            'closes_at' => $day === 0 ? null : '17:00',
        ])->all();

        $this->putJson('/api/v1/vendor/availability', [
            'timezone' => 'Europe/London',
            'days' => $days,
        ])
            ->assertOk()
            ->assertJsonPath('data.timezone', 'Europe/London')
            ->assertJsonPath('data.is_configured', true)
            ->assertJsonPath('data.days.0.is_closed', true)
            ->assertJsonPath('data.days.1.opens_at', '09:00');

        $this->getJson('/api/v1/vendor/availability')
            ->assertOk()
            ->assertJsonPath('data.days.1.closes_at', '17:00');

        $this->postJson('/api/v1/vendor/services', [
            'name' => 'Portrait session',
            'description' => 'A one-hour portrait session.',
            'category' => 'Photography',
            'duration_minutes' => 60,
            'price' => 85,
        ])
            ->assertCreated()
            ->assertJsonPath('data.vendor_profile.business_name', 'Bright Studio');

        $this->getJson('/api/v1/services')
            ->assertOk()
            ->assertJsonPath('data.0.name', 'Portrait session')
            ->assertJsonPath('data.0.vendor_profile.location', 'Downtown')
            ->assertJsonPath('data.0.vendor_profile.timezone', 'Europe/London')
            ->assertJsonPath('data.0.vendor_profile.opening_hours.1.opens_at', '09:00:00');

        $this->getJson('/api/v1/vendor/services')
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $serviceId = $this->getJson('/api/v1/vendor/services')->json('data.0.id');
        $this->putJson("/api/v1/vendor/services/{$serviceId}", [
            'name' => 'Portrait session',
            'description' => 'Updated description.',
            'category' => 'Photography',
            'duration_minutes' => 60,
            'price' => 95,
            'is_active' => false,
        ])->assertOk();

        $this->getJson('/api/v1/services')->assertJsonCount(0, 'data');
        $this->deleteJson("/api/v1/vendor/services/{$serviceId}")->assertOk();
        $this->getJson('/api/v1/vendor/services')->assertJsonCount(0, 'data');
    }

    public function test_customers_cannot_manage_vendor_profiles_or_services(): void
    {
        $customer = User::factory()->create(['role' => UserRole::CUSTOMER]);
        $this->actingAs($customer, 'sanctum')
            ->putJson('/api/v1/vendor/profile', ['business_name' => 'Not allowed'])
            ->assertForbidden();

        $this->getJson('/api/v1/vendor/availability')->assertForbidden();
    }

    public function test_opening_hours_require_valid_time_ranges(): void
    {
        $vendor = User::factory()->create(['role' => UserRole::VENDOR]);
        $vendor->vendorProfile()->create(['business_name' => 'Bright Studio']);
        $days = collect(range(0, 6))->map(fn (int $day) => [
            'day_of_week' => $day,
            'is_closed' => false,
            'opens_at' => '17:00',
            'closes_at' => '09:00',
        ])->all();

        $this->actingAs($vendor, 'sanctum')
            ->putJson('/api/v1/vendor/availability', [
                'timezone' => 'UTC',
                'days' => $days,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('days.0.opens_at');
    }
}

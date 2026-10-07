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
        ])
            ->assertOk()
            ->assertJsonPath('data.business_name', 'Bright Studio');

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
            ->assertJsonPath('data.0.vendor_profile.location', 'Downtown');

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
    }
}

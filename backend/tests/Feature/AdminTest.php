<?php

namespace Tests\Feature;

use App\Enums\BookingStatus;
use App\Enums\UserRole;
use App\Models\Booking;
use App\Models\Service;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_review_and_moderate_platform_records(): void
    {
        $admin = User::factory()->create(['role' => UserRole::ADMIN]);
        $vendor = User::factory()->create(['role' => UserRole::VENDOR]);
        $customer = User::factory()->create(['role' => UserRole::CUSTOMER]);
        $profile = $vendor->vendorProfile()->create([
            'business_name' => 'Bright Studio',
            'location' => 'Downtown',
        ]);
        $service = $profile->services()->create([
            'name' => 'Portrait session',
            'description' => 'A portrait session.',
            'category' => 'Photography',
            'duration_minutes' => 60,
            'price' => 85,
            'is_active' => true,
        ]);
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

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/v1/admin/users')
            ->assertOk()
            ->assertJsonPath('meta.total', 3)
            ->assertJsonMissingPath('data.0.password');

        $this->getJson('/api/v1/admin/vendors')
            ->assertOk()
            ->assertJsonPath('data.0.business_name', 'Bright Studio');

        $this->getJson('/api/v1/admin/services')
            ->assertOk()
            ->assertJsonPath('data.0.name', 'Portrait session');

        $this->getJson('/api/v1/admin/bookings')
            ->assertOk()
            ->assertJsonPath('data.0.customer_email', $customer->email);

        $this->patchJson("/api/v1/admin/services/{$service->id}/visibility", ['is_active' => false])
            ->assertOk()
            ->assertJsonPath('data.is_active', false);
        $this->getJson('/api/v1/services')->assertJsonCount(0, 'data');

        $this->patchJson("/api/v1/admin/bookings/{$booking->id}/status", ['status' => 'rejected'])
            ->assertOk()
            ->assertJsonPath('data.status', 'rejected');
    }

    public function test_admin_can_disable_users_but_cannot_disable_self_or_last_active_admin(): void
    {
        $admin = User::factory()->create(['role' => UserRole::ADMIN]);
        $secondAdmin = User::factory()->create(['role' => UserRole::ADMIN]);
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

        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/v1/admin/users/{$admin->id}/status", ['is_active' => false])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('is_active');

        $this->patchJson("/api/v1/admin/users/{$secondAdmin->id}/status", ['is_active' => false])
            ->assertOk();

        $this->patchJson("/api/v1/admin/users/{$vendor->id}/status", ['is_active' => false])
            ->assertOk()
            ->assertJsonPath('data.is_active', false);
        $this->assertDatabaseHas('services', ['id' => $service->id, 'is_active' => false]);

        $this->actingAs($vendor, 'sanctum')
            ->getJson('/api/v1/vendor/profile')
            ->assertForbidden();
    }

    public function test_non_admin_cannot_access_admin_endpoints(): void
    {
        $vendor = User::factory()->create(['role' => UserRole::VENDOR]);

        $this->actingAs($vendor, 'sanctum')
            ->getJson('/api/v1/admin/users')
            ->assertForbidden();
    }
}

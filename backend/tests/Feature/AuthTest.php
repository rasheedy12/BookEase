<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withHeaders([
            'Origin' => 'http://localhost:5173',
            'Referer' => 'http://localhost:5173/',
        ]);
    }

    public function test_customer_can_register_and_receive_a_safe_user_response(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Avery Customer',
            'email' => 'avery@example.test',
            'password' => 'secure-password-123',
            'password_confirmation' => 'secure-password-123',
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('data.user.email', 'avery@example.test')
            ->assertJsonPath('data.user.role', 'customer')
            ->assertJsonMissingPath('data.user.password');

        $this->assertDatabaseHas('users', [
            'email' => 'avery@example.test',
            'role' => 'customer',
        ]);
        $this->assertNotSame(
            'secure-password-123',
            User::where('email', 'avery@example.test')->value('password'),
        );
    }

    public function test_vendor_can_register_but_admin_cannot_be_self_assigned(): void
    {
        $this->postJson('/api/v1/auth/register', [
            'name' => 'Val Vendor',
            'email' => 'vendor@example.test',
            'password' => 'secure-password-123',
            'password_confirmation' => 'secure-password-123',
            'role' => 'vendor',
        ])
            ->assertCreated()
            ->assertJsonPath('data.user.role', 'vendor');

        $this->postJson('/api/v1/auth/register', [
            'name' => 'Self Made Admin',
            'email' => 'admin@example.test',
            'password' => 'secure-password-123',
            'password_confirmation' => 'secure-password-123',
            'role' => 'admin',
        ])->assertUnprocessable();

        $this->assertDatabaseMissing('users', ['email' => 'admin@example.test']);
    }

    public function test_authenticated_user_can_login_read_their_profile_and_logout(): void
    {
        $user = User::factory()->create([
            'email' => 'user@example.test',
            'password' => 'secure-password-123',
            'role' => UserRole::VENDOR,
        ]);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'user@example.test',
            'password' => 'secure-password-123',
        ])
            ->assertOk()
            ->assertJsonPath('data.user.id', $user->id)
            ->assertJsonPath('data.user.role', 'vendor')
            ->assertJsonMissingPath('data.user.password');

        $this->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('data.user.email', 'user@example.test');

        $this->postJson('/api/v1/auth/logout')
            ->assertOk()
            ->assertJsonPath('message', 'Logged out successfully.');

        Auth::forgetGuards();
        $this->getJson('/api/v1/auth/me')->assertUnauthorized();
    }

    public function test_authentication_is_required_and_role_routes_are_restricted(): void
    {
        $this->getJson('/api/v1/auth/me')->assertUnauthorized();
        $this->get('/api/v1/auth/me')->assertUnauthorized();

        $vendor = User::factory()->create(['role' => UserRole::VENDOR]);
        $this->actingAs($vendor, 'sanctum')
            ->getJson('/api/v1/vendor/dashboard')
            ->assertOk()
            ->assertJsonPath('data.role', 'vendor');

        $this->getJson('/api/v1/admin/dashboard')->assertForbidden();
    }

    public function test_invalid_credentials_are_rejected(): void
    {
        $this->postJson('/api/v1/auth/login', [
            'email' => 'unknown@example.test',
            'password' => 'wrong-password',
        ])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'The provided credentials are incorrect.');
    }
}

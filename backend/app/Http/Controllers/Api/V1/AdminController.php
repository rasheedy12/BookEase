<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\BookingStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Service;
use App\Models\User;
use App\Models\VendorProfile;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AdminController extends Controller
{
    public function users(): JsonResponse
    {
        $users = User::query()->latest()->paginate(25);

        return response()->json([
            'data' => $users->getCollection()->map(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role->value,
                'is_active' => $user->is_active,
                'created_at' => $user->created_at->toIso8601String(),
            ]),
            'meta' => $this->paginationMeta($users),
        ]);
    }

    public function updateUserStatus(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate(['is_active' => ['required', 'boolean']]);
        $isActive = (bool) $validated['is_active'];

        if (! $isActive && $request->user()->is($user)) {
            throw ValidationException::withMessages([
                'is_active' => ['You cannot disable your own administrator account.'],
            ]);
        }

        DB::transaction(function () use ($user, $isActive): void {
            $lockedUser = User::query()->lockForUpdate()->findOrFail($user->id);

            if (! $isActive && $lockedUser->role === UserRole::ADMIN && $lockedUser->is_active) {
                $activeAdmins = User::query()
                    ->where('role', UserRole::ADMIN->value)
                    ->where('is_active', true)
                    ->lockForUpdate()
                    ->get(['id'])
                    ->count();

                if ($activeAdmins <= 1) {
                    throw ValidationException::withMessages([
                        'is_active' => ['The last active administrator cannot be disabled.'],
                    ]);
                }
            }

            $lockedUser->update(['is_active' => $isActive]);

            if (! $isActive && $lockedUser->role === UserRole::VENDOR) {
                $lockedUser->vendorProfile?->services()->update(['is_active' => false]);
            }
        });

        return response()->json([
            'data' => [
                'id' => $user->id,
                'is_active' => $isActive,
            ],
        ]);
    }

    public function vendors(): JsonResponse
    {
        $vendors = VendorProfile::query()
            ->with('user:id,name,email,is_active')
            ->withCount('services')
            ->latest()
            ->paginate(25);

        return response()->json([
            'data' => $vendors->getCollection()->map(fn ($vendor) => [
                'id' => $vendor->id,
                'business_name' => $vendor->business_name,
                'location' => $vendor->location,
                'description' => $vendor->description,
                'services_count' => $vendor->services_count,
                'user' => $vendor->user ? [
                    'id' => $vendor->user->id,
                    'name' => $vendor->user->name,
                    'email' => $vendor->user->email,
                    'is_active' => $vendor->user->is_active,
                ] : null,
            ]),
            'meta' => $this->paginationMeta($vendors),
        ]);
    }

    public function services(): JsonResponse
    {
        $services = Service::query()
            ->with('vendorProfile:id,business_name')
            ->latest()
            ->paginate(25);

        return response()->json([
            'data' => $services->getCollection()->map(fn (Service $service) => [
                'id' => $service->id,
                'name' => $service->name,
                'category' => $service->category,
                'price' => $service->price,
                'is_active' => $service->is_active,
                'business_name' => $service->vendorProfile?->business_name,
            ]),
            'meta' => $this->paginationMeta($services),
        ]);
    }

    public function updateServiceVisibility(Request $request, Service $service): JsonResponse
    {
        $validated = $request->validate(['is_active' => ['required', 'boolean']]);
        $service->update(['is_active' => (bool) $validated['is_active']]);

        return response()->json([
            'data' => [
                'id' => $service->id,
                'is_active' => $service->is_active,
            ],
        ]);
    }

    public function bookings(): JsonResponse
    {
        $bookings = Booking::query()
            ->with(['customer:id,name,email', 'vendorProfile:id,business_name'])
            ->latest('starts_at')
            ->paginate(25);

        return response()->json([
            'data' => $bookings->getCollection()->map(fn (Booking $booking) => [
                'id' => $booking->id,
                'service_name' => $booking->service_name,
                'business_name' => $booking->business_name,
                'customer_name' => $booking->customer?->name,
                'customer_email' => $booking->customer?->email,
                'starts_at' => $booking->starts_at->toIso8601String(),
                'ends_at' => $booking->ends_at->toIso8601String(),
                'price' => $booking->price,
                'status' => $booking->status->value,
            ]),
            'meta' => $this->paginationMeta($bookings),
        ]);
    }

    public function moderateBooking(Request $request, Booking $booking): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['required', Rule::in([
                BookingStatus::REJECTED->value,
                BookingStatus::CANCELLED->value,
            ])],
        ]);

        if (! in_array($booking->status, [BookingStatus::PENDING, BookingStatus::CONFIRMED], true)) {
            throw ValidationException::withMessages([
                'status' => ['Only pending or confirmed bookings can be moderated.'],
            ]);
        }

        $booking->update(['status' => BookingStatus::from($validated['status'])]);

        return response()->json([
            'data' => [
                'id' => $booking->id,
                'status' => $booking->status->value,
            ],
        ]);
    }

    private function paginationMeta(LengthAwarePaginator $paginator): array
    {
        return [
            'current_page' => $paginator->currentPage(),
            'last_page' => $paginator->lastPage(),
            'total' => $paginator->total(),
        ];
    }
}

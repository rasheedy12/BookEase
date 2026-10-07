<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\BookingStatus;
use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Service;
use App\Models\VendorProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class BookingController extends Controller
{
    public function customerIndex(Request $request): JsonResponse
    {
        $bookings = $request->user()->bookings()
            ->with('customer:id,name')
            ->with('vendorProfile.user:id,name')
            ->latest('starts_at')
            ->get();

        return response()->json(['data' => $bookings->map(fn (Booking $booking) => $this->present($booking))]);
    }

    public function vendorIndex(Request $request): JsonResponse
    {
        $bookings = $request->user()->vendorProfile?->bookings()
            ->with('customer:id,name')
            ->latest('starts_at')
            ->get() ?? collect();

        return response()->json(['data' => $bookings->map(fn (Booking $booking) => $this->present($booking))]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'service_id' => ['required', 'integer', 'exists:services,id'],
            'starts_at' => ['required', 'date', 'after:now'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $service = Service::query()->with('vendorProfile')->findOrFail($validated['service_id']);

        if (! $service->is_active || ! $service->vendorProfile) {
            throw ValidationException::withMessages([
                'service_id' => ['This service is no longer available.'],
            ]);
        }

        $startsAt = Carbon::parse($validated['starts_at']);
        $endsAt = $startsAt->copy()->addMinutes($service->duration_minutes);

        $booking = DB::transaction(function () use ($request, $service, $startsAt, $endsAt, $validated): Booking {
            $vendor = VendorProfile::query()
                ->lockForUpdate()
                ->findOrFail($service->vendor_profile_id);

            $hasConflict = $vendor->bookings()
                ->whereIn('status', [BookingStatus::PENDING->value, BookingStatus::CONFIRMED->value])
                ->where('starts_at', '<', $endsAt)
                ->where('ends_at', '>', $startsAt)
                ->exists();

            if ($hasConflict) {
                throw ValidationException::withMessages([
                    'starts_at' => ['This time is no longer available. Please choose another time.'],
                ]);
            }

            return $request->user()->bookings()->create([
                'vendor_profile_id' => $vendor->id,
                'service_id' => $service->id,
                'service_name' => $service->name,
                'business_name' => $vendor->business_name,
                'starts_at' => $startsAt,
                'ends_at' => $endsAt,
                'price' => $service->price,
                'status' => BookingStatus::PENDING,
                'notes' => $validated['notes'] ?? null,
            ]);
        });

        return response()->json(['data' => $this->present($booking->load('customer:id,name'))], 201);
    }

    public function updateStatus(Request $request, Booking $booking): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['required', Rule::enum(BookingStatus::class)],
        ]);

        $newStatus = BookingStatus::from($validated['status']);
        $user = $request->user();

        if ($user->role->value === 'vendor') {
            $profile = $user->vendorProfile;
            if (! $profile || $booking->vendor_profile_id !== $profile->id) {
                abort(404);
            }

            $allowedTransitions = match ($booking->status) {
                BookingStatus::PENDING => [BookingStatus::CONFIRMED, BookingStatus::REJECTED],
                BookingStatus::CONFIRMED => [BookingStatus::COMPLETED],
                default => [],
            };
        } else {
            if ($booking->customer_id !== $user->id) {
                abort(404);
            }

            $allowedTransitions = in_array($booking->status, [BookingStatus::PENDING, BookingStatus::CONFIRMED], true)
                ? [BookingStatus::CANCELLED]
                : [];
        }

        if (! in_array($newStatus, $allowedTransitions, true)) {
            throw ValidationException::withMessages([
                'status' => ['This booking status change is not allowed.'],
            ]);
        }

        $booking->update(['status' => $newStatus]);

        return response()->json(['data' => $this->present($booking->fresh(['customer:id,name']))]);
    }

    /**
     * Return only booking details intended for the current booking participant.
     */
    private function present(Booking $booking): array
    {
        return [
            'id' => $booking->id,
            'service_id' => $booking->service_id,
            'service_name' => $booking->service_name,
            'business_name' => $booking->business_name,
            'customer_name' => $booking->customer?->name,
            'starts_at' => $booking->starts_at->toIso8601String(),
            'ends_at' => $booking->ends_at->toIso8601String(),
            'price' => $booking->price,
            'status' => $booking->status->value,
            'notes' => $booking->notes,
        ];
    }
}

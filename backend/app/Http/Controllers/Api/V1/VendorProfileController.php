<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\VendorOpeningHour;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class VendorProfileController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        return response()->json(['data' => $request->user()->vendorProfile]);
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'business_name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'phone' => ['nullable', 'string', 'max:50'],
            'location' => ['nullable', 'string', 'max:255'],
            'timezone' => ['sometimes', 'required', 'timezone'],
        ]);

        $profile = $request->user()->vendorProfile()->updateOrCreate([], $validated);

        return response()->json(['data' => $profile]);
    }

    public function openingHours(Request $request): JsonResponse
    {
        $profile = $request->user()->vendorProfile()->with('openingHours')->first();
        $hours = $profile?->openingHours ?? collect();

        return response()->json([
            'data' => [
                'timezone' => $profile?->timezone ?? config('app.timezone'),
                'is_configured' => $hours->isNotEmpty(),
                'days' => collect(range(0, 6))->map(function (int $day) use ($hours): array {
                    $hour = $hours->firstWhere('day_of_week', $day);

                    return [
                        'day_of_week' => $day,
                        'is_closed' => $hour?->is_closed ?? true,
                        'opens_at' => $hour?->opens_at ? substr($hour->opens_at, 0, 5) : null,
                        'closes_at' => $hour?->closes_at ? substr($hour->closes_at, 0, 5) : null,
                    ];
                }),
            ],
        ]);
    }

    public function updateOpeningHours(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'timezone' => ['required', 'timezone'],
            'days' => ['required', 'array', 'size:7'],
            'days.*.day_of_week' => ['required', 'integer', 'between:0,6', 'distinct:strict'],
            'days.*.is_closed' => ['required', 'boolean'],
            'days.*.opens_at' => ['nullable', 'date_format:H:i'],
            'days.*.closes_at' => ['nullable', 'date_format:H:i'],
        ]);

        foreach ($validated['days'] as $index => $day) {
            if (! $day['is_closed']
                && (empty($day['opens_at']) || empty($day['closes_at']) || $day['closes_at'] <= $day['opens_at'])) {
                throw ValidationException::withMessages([
                    "days.{$index}.opens_at" => ['Open days need a start and end time, and the end must be later.'],
                ]);
            }
        }

        $profile = $request->user()->vendorProfile;
        if (! $profile) {
            throw ValidationException::withMessages([
                'business_name' => ['Save your business profile before setting opening hours.'],
            ]);
        }

        DB::transaction(function () use ($profile, $validated): void {
            $lockedProfile = $profile->newQuery()->lockForUpdate()->findOrFail($profile->id);
            $lockedProfile->update(['timezone' => $validated['timezone']]);

            foreach ($validated['days'] as $day) {
                VendorOpeningHour::query()->updateOrCreate(
                    [
                        'vendor_profile_id' => $lockedProfile->id,
                        'day_of_week' => $day['day_of_week'],
                    ],
                    [
                        'is_closed' => $day['is_closed'],
                        'opens_at' => $day['is_closed'] ? null : $day['opens_at'],
                        'closes_at' => $day['is_closed'] ? null : $day['closes_at'],
                    ],
                );
            }
        });

        return $this->openingHours($request);
    }
}

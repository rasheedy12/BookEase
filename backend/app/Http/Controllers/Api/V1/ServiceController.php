<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Service;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ServiceController extends Controller
{
    public function index(): JsonResponse
    {
        $services = Service::query()
            ->with('vendorProfile:id,business_name,location')
            ->where('is_active', true)
            ->whereHas('vendorProfile.user', fn ($query) => $query->where('is_active', true))
            ->latest()
            ->get();

        return response()->json(['data' => $services]);
    }

    public function vendorIndex(Request $request): JsonResponse
    {
        $services = $request->user()->vendorProfile
            ? $request->user()->vendorProfile->services()->latest()->get()
            : collect();

        return response()->json(['data' => $services]);
    }

    public function store(Request $request): JsonResponse
    {
        $profile = $request->user()->vendorProfile;

        if (! $profile) {
            return response()->json([
                'message' => 'Complete your vendor profile before adding a service.',
            ], 422);
        }

        $service = $profile->services()->create($this->validatedService($request));

        return response()->json(['data' => $service->load('vendorProfile:id,business_name,location')], 201);
    }

    public function update(Request $request, Service $service): JsonResponse
    {
        $service = $this->ownedService($request, $service);
        $service->update($this->validatedService($request));

        return response()->json(['data' => $service->load('vendorProfile:id,business_name,location')]);
    }

    public function destroy(Request $request, Service $service): JsonResponse
    {
        $this->ownedService($request, $service)->delete();

        return response()->json(['message' => 'Service deleted.']);
    }

    private function ownedService(Request $request, Service $service): Service
    {
        $profile = $request->user()->vendorProfile;

        if (! $profile) {
            abort(404);
        }

        return $profile->services()->findOrFail($service->id);
    }

    private function validatedService(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string', 'max:5000'],
            'category' => ['required', 'string', 'max:100'],
            'duration_minutes' => ['required', 'integer', 'between:5,1440'],
            'price' => ['required', 'numeric', 'min:0', 'max:99999999.99'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
    }
}

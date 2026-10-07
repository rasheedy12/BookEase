<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\BookingController;
use App\Http\Controllers\Api\V1\ServiceController;
use App\Http\Controllers\Api\V1\VendorProfileController;
use Illuminate\Support\Facades\Route;

Route::get('/health', function () {
    return response()->json([
        'status' => 'ok',
        'service' => 'bookease-api',
    ]);
});

Route::get('/v1/services', [ServiceController::class, 'index']);

Route::prefix('v1')->group(function () {
    Route::prefix('auth')->middleware('throttle:10,1')->group(function () {
        Route::post('/register', [AuthController::class, 'register']);
        Route::post('/login', [AuthController::class, 'login']);
    });

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::get('/auth/me', [AuthController::class, 'me']);

        Route::middleware('role:vendor')->group(function () {
            Route::get('/vendor/profile', [VendorProfileController::class, 'show']);
            Route::put('/vendor/profile', [VendorProfileController::class, 'update']);
            Route::get('/vendor/services', [ServiceController::class, 'vendorIndex']);
            Route::post('/vendor/services', [ServiceController::class, 'store']);
            Route::put('/vendor/services/{service}', [ServiceController::class, 'update']);
            Route::delete('/vendor/services/{service}', [ServiceController::class, 'destroy']);
            Route::get('/vendor/bookings', [BookingController::class, 'vendorIndex']);
            Route::patch('/vendor/bookings/{booking}/status', [BookingController::class, 'updateStatus']);
        });

        Route::middleware('role:customer')->group(function () {
            Route::get('/customer/bookings', [BookingController::class, 'customerIndex']);
            Route::post('/customer/bookings', [BookingController::class, 'store']);
            Route::patch('/customer/bookings/{booking}/status', [BookingController::class, 'updateStatus']);
        });

        foreach (['admin', 'vendor', 'customer'] as $role) {
            Route::get("/{$role}/dashboard", fn () => response()->json([
                'data' => ['role' => $role],
            ]))
                ->middleware("role:{$role}");
        }
    });
});

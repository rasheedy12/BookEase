<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained()->cascadeOnDelete();
            $table->string('provider', 32)->default('paystack');
            $table->string('status', 32)->default('pending');
            $table->unsignedBigInteger('amount');
            $table->char('currency', 3);
            $table->string('provider_reference')->nullable()->unique();
            $table->string('transaction_id')->nullable()->index();
            $table->string('refund_id')->nullable()->unique();
            $table->timestamps();
            $table->index(['booking_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->string('receipt_number', 32)->nullable()->unique();
            $table->json('receipt_data')->nullable();
            $table->timestamp('receipt_issued_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropUnique('payments_receipt_number_unique');
            $table->dropColumn(['receipt_number', 'receipt_data', 'receipt_issued_at']);
        });
    }
};

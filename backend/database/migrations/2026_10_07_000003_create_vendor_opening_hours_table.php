<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vendor_profiles', function (Blueprint $table) {
            $table->string('timezone', 64)->default('UTC');
        });

        Schema::create('vendor_opening_hours', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vendor_profile_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('day_of_week');
            $table->boolean('is_closed')->default(true);
            $table->time('opens_at')->nullable();
            $table->time('closes_at')->nullable();
            $table->timestamps();
            $table->unique(['vendor_profile_id', 'day_of_week']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vendor_opening_hours');

        Schema::table('vendor_profiles', function (Blueprint $table) {
            $table->dropColumn('timezone');
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('payments', 'checkout_session_id')) {
            Schema::table('payments', function (Blueprint $table) {
                $table->dropUnique('payments_checkout_session_id_unique');
                $table->renameColumn('checkout_session_id', 'provider_reference');
                $table->unique('provider_reference');
            });
        }

        if (Schema::hasColumn('payments', 'payment_intent_id')) {
            Schema::table('payments', function (Blueprint $table) {
                $table->dropIndex('payments_payment_intent_id_index');
                $table->renameColumn('payment_intent_id', 'transaction_id');
                $table->index('transaction_id');
            });
        }

        Schema::table('payments', function (Blueprint $table) {
            $table->string('provider', 32)->default('paystack')->change();
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->string('provider', 32)->default('stripe')->change();
        });

        if (Schema::hasColumn('payments', 'provider_reference')) {
            Schema::table('payments', function (Blueprint $table) {
                $table->dropUnique('payments_provider_reference_unique');
                $table->renameColumn('provider_reference', 'checkout_session_id');
                $table->unique('checkout_session_id');
            });
        }

        if (Schema::hasColumn('payments', 'transaction_id')) {
            Schema::table('payments', function (Blueprint $table) {
                $table->dropIndex('payments_transaction_id_index');
                $table->renameColumn('transaction_id', 'payment_intent_id');
                $table->index('payment_intent_id');
            });
        }
    }
};

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payment extends Model
{
    protected $fillable = [
        'booking_id',
        'provider',
        'status',
        'amount',
        'currency',
        'provider_reference',
        'transaction_id',
        'refund_id',
        'receipt_number',
        'receipt_data',
        'receipt_issued_at',
    ];

    protected function casts(): array
    {
        return [
            'receipt_data' => 'array',
            'receipt_issued_at' => 'datetime',
        ];
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }
}

<?php

namespace App\Models;

use App\Models\Configuration;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Code extends Model
{
    use HasFactory;

    protected $fillable = [
        'code',
        'configuration_id',
        'value',
        'status',
        'used_at',
    ];

    protected $casts = [
        'value' => 'decimal:2',
        'used_at' => 'datetime',
    ];

    public function configuration()
    {
        return $this->belongsTo(Configuration::class);
    }
}

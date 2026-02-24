<?php

namespace App\Models;

use App\Models\Code;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Configuration extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'total_balloons',
        'total_value',
        'distribution',
    ];

    protected $casts = [
        'distribution' => 'array',
    ];

    public function codes()
    {
        return $this->hasMany(Code::class);
    }
}

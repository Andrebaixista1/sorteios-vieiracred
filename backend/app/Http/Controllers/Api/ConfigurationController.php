<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Configuration;
use Illuminate\Http\Request;

class ConfigurationController extends Controller
{
    public function show()
    {
        $configuration = Configuration::firstOrCreate(
            ['name' => 'default'],
            [
                'total_balloons' => 50,
                'total_value' => 0,
                'distribution' => $this->defaultDistribution(),
            ]
        );

        return response()->json($configuration);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'total_balloons' => 'required|integer|min:40',
            'total_value' => 'required|numeric|min:0',
            'distribution' => 'required|array',
            'distribution.*.min' => 'required|numeric|min:0',
            'distribution.*.max' => 'required|numeric|min:0',
            'distribution.*.weight' => 'required|numeric|min:0|max:50',
        ]);

        $distribution = array_map(function ($bucket) {
            return [
                'min' => intval(round(floatval($bucket['min']))),
                'max' => intval(round(floatval($bucket['max']))),
                'weight' => max(0, min(50, round(floatval($bucket['weight']), 2))),
            ];
        }, $validated['distribution']);

        $configuration = Configuration::updateOrCreate(
            ['name' => 'default'],
            [
                'total_balloons' => intval($validated['total_balloons']),
                'total_value' => intval(round(floatval($validated['total_value']))),
                'distribution' => $distribution,
            ]
        );

        return response()->json($configuration);
    }

    private function defaultDistribution(): array
    {
        return [
            ['min' => 40, 'max' => 49, 'weight' => 32],
            ['min' => 50, 'max' => 59, 'weight' => 22],
            ['min' => 60, 'max' => 69, 'weight' => 13],
            ['min' => 70, 'max' => 79, 'weight' => 20],
            ['min' => 80, 'max' => 89, 'weight' => 7],
            ['min' => 90, 'max' => 99, 'weight' => 4],
            ['min' => 100, 'max' => 110, 'weight' => 2],
        ];
    }
}

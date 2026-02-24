<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Configuration;
use Illuminate\Http\Exceptions\HttpResponseException;
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
            'total_balloons' => 'required|integer|min:10',
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

        $totalBalloons = intval($validated['total_balloons']);
        $totalValue = intval(round(floatval($validated['total_value'])));
        [$availableUniqueCount, $minimumNoZeroTotal] = $this->calculateMinimumNoZero(
            $distribution,
            $totalBalloons,
        );

        if ($availableUniqueCount < $totalBalloons) {
            throw new HttpResponseException(
                response()->json([
                    'message' => "Configuração impossível: existem apenas {$availableUniqueCount} valores únicos para {$totalBalloons} balões sem repetir.",
                ], 422)
            );
        }

        if ($totalValue < $minimumNoZeroTotal) {
            throw new HttpResponseException(
                response()->json([
                    'message' => 'Total insuficiente para evitar prêmio zerado. Mínimo: R$ ' . $minimumNoZeroTotal . '.',
                ], 422)
            );
        }

        $configuration = Configuration::updateOrCreate(
            ['name' => 'default'],
            [
                'total_balloons' => $totalBalloons,
                'total_value' => $totalValue,
                'distribution' => $distribution,
            ]
        );

        return response()->json($configuration);
    }

    private function defaultDistribution(): array
    {
        return [
            ['min' => 1, 'max' => 20, 'weight' => 24],
            ['min' => 21, 'max' => 40, 'weight' => 34],
            ['min' => 41, 'max' => 60, 'weight' => 50],
            ['min' => 61, 'max' => 80, 'weight' => 33],
            ['min' => 81, 'max' => 100, 'weight' => 13],
        ];
    }

    private function calculateMinimumNoZero(array $distribution, int $quantity): array
    {
        $values = [];

        foreach ($distribution as $bucket) {
            $weight = floatval($bucket['weight'] ?? 0);
            if ($weight <= 0) {
                continue;
            }

            $min = max(0, intval(round(floatval($bucket['min'] ?? 0))));
            $max = max($min, intval(round(floatval($bucket['max'] ?? $min))));

            for ($value = $min; $value <= $max; $value++) {
                if ($value > 0) {
                    $values[$value] = true;
                }
            }
        }

        $distinctValues = array_keys($values);
        sort($distinctValues, SORT_NUMERIC);

        $needed = max(0, $quantity);
        $minimumTotal = array_sum(array_slice($distinctValues, 0, $needed));

        return [count($distinctValues), intval($minimumTotal)];
    }
}


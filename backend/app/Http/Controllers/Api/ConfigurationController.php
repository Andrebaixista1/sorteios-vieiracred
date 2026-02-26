<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Configuration;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;

class ConfigurationController extends Controller
{
    private const DEFAULT_PRANK_PERCENTAGE = 20;
    private const MAX_PRANK_PERCENTAGE = 95;

    private const DEFAULT_PRANKS = [
        'Ganhe um abraço',
        'Ganhe um abraço do gerente',
        'Vale elogio em voz alta',
        'Ganhe um aperto de mão premium',
        'Ganhe um abraço do Wesley',
        'Fica de boas não foi dessa vez',
        'Vai ter que fazer uma dancinha (30s)',
        'Vale um cookie pago pela Angela',
    ];

    public function show()
    {
        $configuration = Configuration::firstOrCreate(
            ['name' => 'default'],
            [
                'total_balloons' => 50,
                'total_value' => 0,
                'prank_percentage' => self::DEFAULT_PRANK_PERCENTAGE,
                'distribution' => $this->defaultDistribution(),
            ]
        );

        return response()->json($this->appendPrankMeta($configuration));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'total_balloons' => 'required|integer|min:10',
            'total_value' => 'required|numeric|min:0',
            'prank_percentage' => 'nullable|numeric|min:0|max:95',
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
        $prankPercentage = $this->normalizePrankPercentage($validated['prank_percentage'] ?? null);
        $prankBalloons = $this->getPrankBalloonCount($totalBalloons, $prankPercentage);
        $moneyBalloons = max(0, $totalBalloons - $prankBalloons);

        [$availableUniqueCount, $minimumNoZeroTotal] = $this->calculateMoneyRangeTotals(
            $distribution,
            $moneyBalloons,
        );

        if ($availableUniqueCount < $moneyBalloons) {
            throw new HttpResponseException(
                response()->json([
                    'message' => "Configuracao impossivel: existem apenas {$availableUniqueCount} valores unicos para {$moneyBalloons} baloes de dinheiro sem repetir.",
                ], 422)
            );
        }

        if ($totalValue < $minimumNoZeroTotal) {
            throw new HttpResponseException(
                response()->json([
                    'message' => 'Total insuficiente para evitar premio zerado. Minimo: R$ ' . $minimumNoZeroTotal . '.',
                ], 422)
            );
        }

        $configuration = Configuration::updateOrCreate(
            ['name' => 'default'],
            [
                'total_balloons' => $totalBalloons,
                'total_value' => $totalValue,
                'prank_percentage' => $prankPercentage,
                'distribution' => $distribution,
            ]
        );

        return response()->json($this->appendPrankMeta($configuration));
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

    private function calculateMoneyRangeTotals(array $distribution, int $quantity): array
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

    private function normalizePrankPercentage($value): int
    {
        $numeric = intval(round(floatval($value ?? self::DEFAULT_PRANK_PERCENTAGE)));

        return max(0, min(self::MAX_PRANK_PERCENTAGE, $numeric));
    }

    private function getPrankBalloonCount(int $totalBalloons, int $prankPercentage): int
    {
        $maxPranksKeepingMoney = max(0, $totalBalloons - 1);
        $requestedPranks = (int) round(($totalBalloons * max(0, $prankPercentage)) / 100);

        return min($maxPranksKeepingMoney, max(0, $requestedPranks));
    }

    private function appendPrankMeta(Configuration $configuration): array
    {
        $data = $configuration->toArray();
        $totalBalloons = intval($configuration->total_balloons);
        $prankPercentage = $this->normalizePrankPercentage($configuration->prank_percentage ?? null);
        $prankBalloons = $this->getPrankBalloonCount($totalBalloons, $prankPercentage);
        $moneyBalloons = max(0, $totalBalloons - $prankBalloons);

        $data['prank_percentage'] = $prankPercentage;
        $data['prank_balloons'] = $prankBalloons;
        $data['money_balloons'] = $moneyBalloons;
        $data['prank_chance_percent'] = $totalBalloons > 0
            ? intval(round(($prankBalloons / $totalBalloons) * 100))
            : 0;
        $data['prank_options'] = self::DEFAULT_PRANKS;

        return $data;
    }
}

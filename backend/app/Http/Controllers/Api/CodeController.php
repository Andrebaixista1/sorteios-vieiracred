<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Code;
use App\Models\Configuration;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CodeController extends Controller
{
    private const DEFAULT_PRANK_PERCENTAGE = 20;
    private const MAX_PRANK_PERCENTAGE = 95;

    private const DEFAULT_PRANKS = [
        'Ganhe um doce do Hugo',
        'Ganhe um doce do Ryan',
        'Ganhe um doce da Jheni',
        'Não foi dessa vez',
        'Dança gatinho (30s)',
        'Vale PIX $10 (sem nada você não fica)',
        'Ganhe PIX $5 (da Jeeh Rainha)',
    ];

    public function index()
    {
        $configurationId = request()->query('configuration_id');

        $codes = Code::with('configuration')
            ->when($configurationId, fn ($query) => $query->where('configuration_id', $configurationId))
            ->orderByRaw("CASE WHEN status = 'used' THEN 0 ELSE 1 END")
            ->orderByDesc('used_at')
            ->orderByDesc('created_at')
            ->limit(50)
            ->get();

        return response()->json($codes);
    }

    public function store(Request $request)
    {
        $payload = $request->validate([
            'quantity' => 'required|integer|min:1',
            'configuration_id' => 'required|exists:configurations,id',
        ]);

        $configuration = Configuration::findOrFail($payload['configuration_id']);
        $codes = $this->createCodes($configuration, $payload['quantity']);

        return response()->json([
            'codes' => $codes,
            'configuration' => $configuration,
        ]);
    }

    public function validateCode(Request $request)
    {
        $payload = $request->validate([
            'code' => 'required|string',
        ]);

        $code = Code::where('code', strtoupper($payload['code']))
            ->where('status', 'pending')
            ->lockForUpdate()
            ->first();

        if (!$code) {
            return response()->json([
                'success' => false,
                'message' => 'Código inválido ou já utilizado',
            ], 404);
        }

        $configuration = $code->configuration;
        $outcome = $this->allocateOutcome($configuration, $code->code);

        $code->update([
            'status' => 'used',
            'used_at' => now(),
            'value' => $outcome['value'],
        ]);

        return response()->json([
            'success' => true,
            'code' => $code->code,
            'value' => (int) round($code->value),
            'result_type' => $outcome['result_type'],
            'prank_label' => $outcome['prank_label'],
        ]);
    }

    public function checkToken(Request $request)
    {
        $payload = $request->validate([
            'code' => 'required|string',
        ]);

        $codeExists = Code::where('code', strtoupper($payload['code']))
            ->where('status', 'pending')
            ->exists();

        if (!$codeExists) {
            $this->errorResponse('Código inválido ou já utilizado', 404);
        }

        return response()->json(['success' => true]);
    }

    public function reset(Request $request)
    {
        $payload = $request->validate([
            'configuration_id' => 'required|exists:configurations,id',
            'quantity' => 'required|integer|min:1',
        ]);

        $configuration = Configuration::findOrFail($payload['configuration_id']);
        $oldCodes = Code::where('configuration_id', $payload['configuration_id'])
            ->pluck('code')
            ->all();

        $affected = count($oldCodes);

        Code::where('configuration_id', $payload['configuration_id'])->delete();
        $codes = $this->createCodes(
            $configuration,
            (int) $payload['quantity'],
            $oldCodes,
        );

        return response()->json([
            'success' => true,
            'deleted_count' => $affected,
            'generated_count' => count($codes),
            'codes' => $codes,
        ]);
    }

    public function playPop()
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

        $totalBalloons = (int) $configuration->total_balloons;
        $usedCount = Code::where('configuration_id', $configuration->id)
            ->where('status', 'used')
            ->count();

        if ($usedCount >= $totalBalloons) {
            $this->errorResponse('Todos os balões desta rodada já foram estourados.');
        }

        $code = Code::where('configuration_id', $configuration->id)
            ->where('status', 'pending')
            ->orderBy('id')
            ->lockForUpdate()
            ->first();

        if (!$code) {
            $code = Code::create([
                'configuration_id' => $configuration->id,
                'code' => $this->generateCode(),
                'status' => 'pending',
                'value' => 0,
            ]);
        }

        $outcome = $this->allocateOutcome($configuration, $code->code);

        $code->update([
            'status' => 'used',
            'used_at' => now(),
            'value' => $outcome['value'],
        ]);

        return response()->json([
            'success' => true,
            'value' => (int) round($code->value),
            'code' => $code->code,
            'result_type' => $outcome['result_type'],
            'prank_label' => $outcome['prank_label'],
        ]);
    }

    public function playSummary()
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

        $baseQuery = Code::query()->where('configuration_id', $configuration->id);
        $usedQuery = (clone $baseQuery)->where('status', 'used');
        $pendingQuery = (clone $baseQuery)->where('status', 'pending');

        $awardedTotal = (int) round((clone $usedQuery)->sum('value'));
        $totalValue = (int) round($configuration->total_value);
        $remainingTotal = max(0, $totalValue - $awardedTotal);
        $totalBalloons = (int) $configuration->total_balloons;
        $prankBalloons = $this->getPrankBalloonCount($configuration);
        $moneyBalloons = $this->getMoneyBalloonCount($configuration);
        $prankChancePercent = $totalBalloons > 0
            ? (int) round(($prankBalloons / $totalBalloons) * 100)
            : 0;
        $configuredPrankPercentage = $this->normalizePrankPercentage($configuration->prank_percentage ?? null);
        $usedBalloons = min($totalBalloons, (int) (clone $usedQuery)->count());
        $remainingBalloons = max(0, $totalBalloons - $usedBalloons);
        $usedPranks = min(
            $prankBalloons,
            (int) (clone $usedQuery)->where('value', '<=', 0)->count()
        );

        $recentUsed = (clone $usedQuery)
            ->orderByDesc('used_at')
            ->orderByDesc('id')
            ->limit(12)
            ->get(['id', 'code', 'value', 'status', 'used_at'])
            ->map(fn (Code $code) => $this->serializeUsedCodeResult($code))
            ->values();

        $usedResults = (clone $usedQuery)
            ->orderBy('used_at')
            ->orderBy('id')
            ->get(['id', 'code', 'value', 'status', 'used_at'])
            ->map(fn (Code $code) => $this->serializeUsedCodeResult($code))
            ->values();

        return response()->json([
            'configuration' => [
                'id' => $configuration->id,
                'name' => $configuration->name,
                'total_balloons' => (int) $configuration->total_balloons,
                'money_balloons' => $moneyBalloons,
                'prank_balloons' => $prankBalloons,
                'prank_percentage' => $configuredPrankPercentage,
                'prank_chance_percent' => $prankChancePercent,
                'prank_options' => $this->getPrankOptions(),
                'total_value' => $totalValue,
                'distribution' => $configuration->distribution,
            ],
            'summary' => [
                'total_tokens' => (int) (clone $baseQuery)->count(),
                'used_tokens' => (int) (clone $usedQuery)->count(),
                'pending_tokens' => (int) (clone $pendingQuery)->count(),
                'awarded_total' => $awardedTotal,
                'remaining_total' => $remainingTotal,
                'used_balloons' => $usedBalloons,
                'remaining_balloons' => $remainingBalloons,
                'used_pranks' => $usedPranks,
                'remaining_pranks' => max(0, $prankBalloons - $usedPranks),
            ],
            'recent_used' => $recentUsed,
            'used_results' => $usedResults,
        ]);
    }

    private function createCodes(Configuration $configuration, int $quantity, array $reservedCodes = []): array
    {
        $created = [];
        $reservedLookup = [];

        foreach ($reservedCodes as $reservedCode) {
            $reservedLookup[strtoupper((string) $reservedCode)] = true;
        }

        DB::transaction(function () use (&$created, $configuration, $quantity, &$reservedLookup) {
            for ($i = 0; $i < $quantity; $i++) {
                $code = Code::create([
                    'configuration_id' => $configuration->id,
                    'code' => $this->generateCode($reservedLookup),
                    'status' => 'pending',
                    'value' => 0,
                ]);

                $created[] = $code;
            }
        });

        return array_map(fn (Code $code) => [
            'id' => $code->id,
            'code' => $code->code,
            'value' => $code->value,
            'status' => $code->status,
            'configuration_id' => $code->configuration_id,
        ], $created);
    }

    private function allocateValue(Configuration $configuration): int
    {
        $distribution = $this->prepareDistribution($configuration);
        $distribution = $this->markTopBucketAsOpenEnded($distribution);

        $totalMoneyBalloons = $this->getMoneyBalloonCount($configuration);
        $usedMoneyCount = (int) Code::where('configuration_id', $configuration->id)
            ->where('status', 'used')
            ->where('value', '>', 0)
            ->count();
        $remainingMoneyBalloons = max(0, $totalMoneyBalloons - $usedMoneyCount);

        $allocated = (int) round(
            Code::where('configuration_id', $configuration->id)
                ->where('status', 'used')
                ->sum('value')
        );

        $remainingValue = max(0, (int) round($configuration->total_value) - $allocated);
        $usedPositiveValues = Code::where('configuration_id', $configuration->id)
            ->where('status', 'used')
            ->where('value', '>', 0)
            ->pluck('value')
            ->map(fn ($value) => (int) round($value))
            ->unique()
            ->values()
            ->all();
        $usedValueLookup = array_fill_keys($usedPositiveValues, true);

        if ($remainingMoneyBalloons <= 0) {
            $this->errorResponse('Nao ha baloes restantes para distribuir.');
        }

        if ($remainingValue <= 0) {
            return 0;
        }

        if ($remainingMoneyBalloons === 1 && !isset($usedValueLookup[$remainingValue])) {
            return $remainingValue;
        }

        $allAvailableValues = $this->getAvailableUniqueValues(
            $distribution->all(),
            $remainingValue,
            $usedValueLookup,
        );

        if (!$this->canReachExactTotal($allAvailableValues, $remainingMoneyBalloons, $remainingValue)) {
            $this->errorResponse('Nao foi possivel fechar o valor total com os baloes restantes.');
        }

        $bucketCandidates = [];
        $feasibilityCache = [];

        foreach ($distribution as $bucket) {
            $candidateValues = $this->getAvailableUniqueValues(
                [$bucket],
                $remainingValue,
                $usedValueLookup,
            );

            if (empty($candidateValues)) {
                continue;
            }

            $feasibleValues = [];
            foreach ($candidateValues as $candidateValue) {
                if ($this->canFinishAfterChoosingValue(
                    $candidateValue,
                    $allAvailableValues,
                    $remainingMoneyBalloons,
                    $remainingValue,
                    $feasibilityCache,
                )) {
                    $feasibleValues[] = $candidateValue;
                }
            }

            if (!empty($feasibleValues)) {
                $bucketCandidates[] = array_merge(
                    $bucket,
                    ['feasible_values' => $feasibleValues]
                );
            }
        }

        if (empty($bucketCandidates)) {
            $this->errorResponse('Nao foi possivel encontrar premio valido para fechar o total.');
        }

        return $this->pickBalancedFeasibleValue(
            $bucketCandidates,
            $remainingValue,
            $remainingMoneyBalloons,
            $usedMoneyCount,
            $totalMoneyBalloons,
        );
    }

    private function allocateOutcome(Configuration $configuration, ?string $code = null): array
    {
        if ($this->shouldAssignPrank($configuration)) {
            return [
                'value' => 0,
                'result_type' => 'prank',
                'prank_label' => $this->pickPrankLabel($code),
            ];
        }

        return [
            'value' => $this->allocateValue($configuration),
            'result_type' => 'money',
            'prank_label' => null,
        ];
    }

    private function prepareDistribution(Configuration $configuration)
    {
        return collect($configuration->distribution)
            ->filter(
                fn ($bucket) =>
                ($bucket['max'] ?? 0) >= ($bucket['min'] ?? 0)
                && ($bucket['weight'] ?? 0) > 0
            )
            ->values()
            ->whenEmpty(function () {
                $this->errorResponse('Distribuição inválida');
            });
    }

    private function markTopBucketAsOpenEnded($distribution)
    {
        if (!$distribution || $distribution->isEmpty()) {
            return $distribution;
        }

        $topIndex = null;
        $topMax = PHP_INT_MIN;
        $topMin = PHP_INT_MIN;

        foreach ($distribution as $index => $bucket) {
            $bucketMax = (int) round($bucket['max'] ?? 0);
            $bucketMin = (int) round($bucket['min'] ?? 0);

            if (
                $bucketMax > $topMax
                || ($bucketMax === $topMax && $bucketMin >= $topMin)
            ) {
                $topIndex = $index;
                $topMax = $bucketMax;
                $topMin = $bucketMin;
            }
        }

        return $distribution
            ->map(function ($bucket, $index) use ($topIndex) {
                $bucket['open_ended'] = $index === $topIndex;
                return $bucket;
            })
            ->values();
    }

    private function pickBucket($distribution)
    {
        $totalWeight = $distribution->sum('weight');
        $cursor = mt_rand() / mt_getrandmax() * $totalWeight;

        foreach ($distribution as $bucket) {
            $cursor -= $bucket['weight'];
            if ($cursor <= 0) {
                return $bucket;
            }
        }

        return $distribution->last();
    }

    private function pickBalancedFeasibleValue(
        array $bucketCandidates,
        int $remainingValue,
        int $remainingMoneyBalloons,
        int $usedMoneyCount,
        int $totalMoneyBalloons
    ): int {
        $average = $remainingMoneyBalloons > 0
            ? ($remainingValue / $remainingMoneyBalloons)
            : $remainingValue;

        // Rotate the target slightly to avoid visible clustering while keeping
        // the round balanced and still solvable.
        $pattern = [0.92, 1.08, 1.0];
        $factor = $pattern[$usedMoneyCount % count($pattern)] ?? 1.0;
        $target = max(1, $average * $factor);

        $weightedValues = [];

        foreach ($bucketCandidates as $bucket) {
            $bucketWeight = max(1.0, (float) ($bucket['weight'] ?? 1));
            foreach (($bucket['feasible_values'] ?? []) as $candidateValue) {
                $value = (int) $candidateValue;
                $distanceRatio = abs($value - $target) / max(1.0, $average);
                $balanceWeight = 1 / (1 + ($distanceRatio * 2.2));
                $weight = $bucketWeight * $balanceWeight;

                if (!isset($weightedValues[$value])) {
                    $weightedValues[$value] = 0.0;
                }

                $weightedValues[$value] += $weight;
            }
        }

        if (empty($weightedValues)) {
            $this->errorResponse('Nao foi possivel selecionar valor balanceado.');
        }

        return $this->pickWeightedNumericValue($weightedValues);
    }

    private function pickWeightedNumericValue(array $weightedValues): int
    {
        $totalWeight = 0.0;
        foreach ($weightedValues as $weight) {
            $totalWeight += max(0.0, (float) $weight);
        }

        if ($totalWeight <= 0) {
            $keys = array_keys($weightedValues);
            return (int) $keys[array_rand($keys)];
        }

        $cursor = (mt_rand() / mt_getrandmax()) * $totalWeight;

        foreach ($weightedValues as $value => $weight) {
            $cursor -= max(0.0, (float) $weight);
            if ($cursor <= 0) {
                return (int) $value;
            }
        }

        $keys = array_keys($weightedValues);

        return (int) end($keys);
    }

    private function bucketHasAvailableUniqueValue(array $bucket, int $remainingValue, array $usedValueLookup): bool
    {
        $min = max(0, (int) round($bucket['min']));
        $max = max($min, (int) round($bucket['max']));
        $isOpenEnded = (bool) ($bucket['open_ended'] ?? false);
        $maxAllowed = $isOpenEnded ? $remainingValue : min($max, $remainingValue);

        if ($remainingValue < $min || $maxAllowed < $min) {
            return false;
        }

        for ($value = $min; $value <= $maxAllowed; $value++) {
            if (!isset($usedValueLookup[$value])) {
                return true;
            }
        }

        return false;
    }

    private function getAvailableUniqueValues(array $distribution, int $remainingValue, array $usedValueLookup): array
    {
        $values = [];

        foreach ($distribution as $bucket) {
            $min = max(0, (int) round($bucket['min'] ?? 0));
            $max = max($min, (int) round($bucket['max'] ?? $min));
            $isOpenEnded = (bool) ($bucket['open_ended'] ?? false);
            $maxAllowed = $isOpenEnded ? $remainingValue : min($max, $remainingValue);

            if ($maxAllowed < $min) {
                continue;
            }

            for ($value = $min; $value <= $maxAllowed; $value++) {
                if ($value <= 0 || isset($usedValueLookup[$value])) {
                    continue;
                }

                $values[$value] = $value;
            }
        }

        $values = array_values($values);
        sort($values, SORT_NUMERIC);

        return $values;
    }

    private function canFinishAfterChoosingValue(
        int $chosenValue,
        array $allAvailableValues,
        int $remainingBalloons,
        int $remainingValue,
        array &$cache
    ): bool {
        $countAfter = $remainingBalloons - 1;
        $targetAfter = $remainingValue - $chosenValue;

        if ($countAfter == 0) {
            return $targetAfter == 0;
        }

        if ($countAfter < 0 || $targetAfter <= 0) {
            return false;
        }

        $cacheKey = $chosenValue . '|' . $countAfter . '|' . $targetAfter;
        if (array_key_exists($cacheKey, $cache)) {
            return $cache[$cacheKey];
        }

        $remainingChoices = [];
        foreach ($allAvailableValues as $value) {
            if ($value !== $chosenValue) {
                $remainingChoices[] = $value;
            }
        }

        $cache[$cacheKey] = $this->canReachExactTotal($remainingChoices, $countAfter, $targetAfter);

        return $cache[$cacheKey];
    }

    private function canReachExactTotal(array $availableValues, int $countNeeded, int $target): bool
    {
        if ($countNeeded < 0 || $target < 0) {
            return false;
        }

        if ($countNeeded === 0) {
            return $target === 0;
        }

        $availableCount = count($availableValues);
        if ($availableCount === 0 || $countNeeded > $availableCount) {
            return false;
        }

        sort($availableValues, SORT_NUMERIC);

        $minPossible = array_sum(array_slice($availableValues, 0, $countNeeded));
        $maxPossible = array_sum(array_slice($availableValues, -$countNeeded));
        if ($target < $minPossible || $target > $maxPossible) {
            return false;
        }

        $reachable = array_fill(0, $countNeeded + 1, []);
        $reachable[0] = [0 => true];

        $processed = 0;
        foreach ($availableValues as $value) {
            $processed += 1;
            $limit = min($countNeeded, $processed);

            for ($count = $limit; $count >= 1; $count--) {
                if (empty($reachable[$count - 1])) {
                    continue;
                }

                foreach ($reachable[$count - 1] as $sum => $_) {
                    $newSum = (int) $sum + $value;
                    if ($newSum > $target) {
                        continue;
                    }

                    $reachable[$count][$newSum] = true;
                }
            }

            if (isset($reachable[$countNeeded][$target])) {
                return true;
            }
        }

        return isset($reachable[$countNeeded][$target]);
    }

    private function pickValueWithinBucket(array $bucket, int $remainingValue, array $usedValueLookup = []): int
    {
        $min = max(0, (int) round($bucket['min']));
        $max = max($min, (int) round($bucket['max']));

        if ($remainingValue < $min) {
            return 0;
        }

        $maxAllowed = min($max, $remainingValue);
        if ($min >= $maxAllowed) {
            return isset($usedValueLookup[$min]) ? 0 : $min;
        }

        $availableValues = [];
        for ($value = $min; $value <= $maxAllowed; $value++) {
            if (!isset($usedValueLookup[$value])) {
                $availableValues[] = $value;
            }
        }

        if (empty($availableValues)) {
            return 0;
        }

        return $availableValues[array_rand($availableValues)];
    }

    private function generateCode(array &$reservedLookup = []): string
    {
        do {
            $candidate = Str::upper(Str::random(4));
        } while (
            isset($reservedLookup[$candidate]) ||
            Code::where('code', $candidate)->exists()
        );

        $reservedLookup[$candidate] = true;

        return $candidate;
    }

    private function errorResponse(string $message, int $status = 422): void
    {
        throw new HttpResponseException(
            response()->json(['message' => $message], $status)
        );
    }

    private function getPrankOptions(): array
    {
        return self::DEFAULT_PRANKS;
    }

    private function getPrankBalloonCount(Configuration $configuration): int
    {
        $totalBalloons = max(0, (int) $configuration->total_balloons);
        $prankPercentage = $this->normalizePrankPercentage($configuration->prank_percentage ?? null);
        $maxPranksKeepingMoney = max(0, $totalBalloons - 1);
        $requestedPranks = (int) round(($totalBalloons * $prankPercentage) / 100);

        return min($maxPranksKeepingMoney, max(0, $requestedPranks));
    }

    private function getMoneyBalloonCount(Configuration $configuration): int
    {
        return max(0, (int) $configuration->total_balloons - $this->getPrankBalloonCount($configuration));
    }

    private function shouldAssignPrank(Configuration $configuration): bool
    {
        $configurationId = $configuration->id;
        $totalBalloons = max(0, (int) $configuration->total_balloons);
        $totalPranks = $this->getPrankBalloonCount($configuration);

        if ($configurationId <= 0 || $totalBalloons <= 0 || $totalPranks <= 0) {
            return false;
        }

        $usedCount = (int) Code::where('configuration_id', $configurationId)
            ->where('status', 'used')
            ->count();
        $usedPranks = (int) Code::where('configuration_id', $configurationId)
            ->where('status', 'used')
            ->where('value', '<=', 0)
            ->count();

        $remainingPops = max(0, $totalBalloons - $usedCount);
        $remainingPranks = max(0, $totalPranks - $usedPranks);

        if ($remainingPranks <= 0 || $remainingPops <= 0) {
            return false;
        }

        if ($remainingPranks >= $remainingPops) {
            return true;
        }

        return random_int(1, $remainingPops) <= $remainingPranks;
    }

    private function pickPrankLabel(?string $seed = null): string
    {
        $options = $this->getPrankOptions();
        if (empty($options)) {
            return 'Pegadinha surpresa';
        }

        if ($seed === null || $seed === '') {
            return $options[array_rand($options)];
        }

        $hash = (int) sprintf('%u', crc32(strtoupper((string) $seed)));
        $index = $hash % count($options);

        return $options[$index];
    }

    private function buildOutcomePayload(Code $code): array
    {
        $isPrank = ((float) $code->value) <= 0;

        return [
            'result_type' => $isPrank ? 'prank' : 'money',
            'prank_label' => $isPrank ? $this->pickPrankLabel($code->code) : null,
        ];
    }

    private function serializeUsedCodeResult(Code $code): array
    {
        $outcome = $this->buildOutcomePayload($code);

        return [
            'id' => $code->id,
            'code' => $code->code,
            'value' => (int) round($code->value),
            'status' => $code->status,
            'result_type' => $outcome['result_type'],
            'prank_label' => $outcome['prank_label'],
            'used_at' => optional($code->used_at)->toISOString(),
        ];
    }

    private function normalizePrankPercentage($value): int
    {
        $numeric = (int) round(floatval($value ?? self::DEFAULT_PRANK_PERCENTAGE));

        return max(0, min(self::MAX_PRANK_PERCENTAGE, $numeric));
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
}

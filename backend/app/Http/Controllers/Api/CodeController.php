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
    public function index()
    {
        $codes = Code::with('configuration')
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
        $value = $this->allocateValue($configuration);

        $code->update([
            'status' => 'used',
            'used_at' => now(),
            'value' => $value,
        ]);

        return response()->json([
            'success' => true,
            'code' => $code->code,
            'value' => $code->value,
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

    private function createCodes(Configuration $configuration, int $quantity): array
    {
        if ($configuration->total_value <= 0) {
            $this->errorResponse('O valor total deve ser maior que zero antes de gerar códigos.');
        }

        $created = [];

        DB::transaction(function () use (&$created, $configuration, $quantity) {
            for ($i = 0; $i < $quantity; $i++) {
                $code = Code::create([
                    'configuration_id' => $configuration->id,
                    'code' => $this->generateCode(),
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

        $pendingCount = Code::where('configuration_id', $configuration->id)
            ->where('status', 'pending')
            ->count();

        $allocated = (int) round(Code::where('configuration_id', $configuration->id)
            ->where('status', 'used')
            ->sum('value'));

        $remainingValue = max(
            0,
            (int) round($configuration->total_value) - $allocated
        );

        if ($pendingCount <= 0 || $remainingValue <= 0) {
            $this->errorResponse('Não há valor restante para distribuir.');
        }

        $bucket = $this->pickBucket($distribution);
        return $this->pickValueWithinBucket($bucket, $remainingValue, $pendingCount);
    }

    private function prepareDistribution(Configuration $configuration)
    {
        return collect($configuration->distribution)
            ->filter(fn ($bucket) => ($bucket['max'] ?? 0) >= ($bucket['min'] ?? 0) && ($bucket['weight'] ?? 0) > 0)
            ->values()
            ->whenEmpty(function () {
                $this->errorResponse('Distribuição inválida');
            });
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

    private function pickValueWithinBucket(array $bucket, int $remainingValue, int $remainingCount): int
    {
        $min = max(0, (int) round($bucket['min']));
        $max = max($min, (int) round($bucket['max']));

        $averageRemaining = $remainingCount > 0
            ? (int) floor($remainingValue / $remainingCount)
            : $remainingValue;
        $effectiveMin = min($min, max(0, $averageRemaining));

        if ($remainingCount <= 1) {
            return max(0, min($remainingValue, $max));
        }

        $minAllowed = max($effectiveMin, $remainingValue - ($remainingCount - 1) * $max);
        $maxAllowed = min($max, $remainingValue - ($remainingCount - 1) * $effectiveMin);

        if ($minAllowed > $maxAllowed) {
            $minAllowed = $maxAllowed = max(
                $effectiveMin,
                min($max, (int) floor($remainingValue / $remainingCount))
            );
        }

        $value = $minAllowed >= $maxAllowed
            ? $minAllowed
            : random_int($minAllowed, $maxAllowed);
        $value = min(
            $value,
            $remainingValue - max(0, $remainingCount - 1) * $effectiveMin
        );
        return max($effectiveMin, min($value, $max));
    }

    private function generateCode(): string
    {
        do {
            $candidate = Str::upper(Str::random(4));
        } while (Code::where('code', $candidate)->exists());

        return $candidate;
    }

    private function errorResponse(string $message, int $status = 422): void
    {
        throw new HttpResponseException(
            response()->json(['message' => $message], $status)
        );
    }
}

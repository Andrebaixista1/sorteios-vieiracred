<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class RestrictAllowedIp
{
    private const ALLOWED_IP = '45.224.161.116';

    public function handle(Request $request, Closure $next)
    {
        $clientIp = $this->resolveClientIp($request);

        // Keep local/server checks working.
        if (in_array($clientIp, ['127.0.0.1', '::1'], true)) {
            return $next($request);
        }

        if ($clientIp !== self::ALLOWED_IP) {
            return response()->json([
                'message' => 'IP não permitido',
                'client_ip' => $clientIp,
                'allowed_ip' => self::ALLOWED_IP,
            ], 403);
        }

        return $next($request);
    }

    private function resolveClientIp(Request $request): string
    {
        $headers = [
            'CF-Connecting-IP',
            'X-Forwarded-For',
            'X-Real-IP',
        ];

        foreach ($headers as $header) {
            $value = trim((string) $request->headers->get($header, ''));
            if ($value === '') {
                continue;
            }

            $candidate = trim(explode(',', $value)[0]);
            if (filter_var($candidate, FILTER_VALIDATE_IP)) {
                return $candidate;
            }
        }

        return (string) ($request->ip() ?? '');
    }
}

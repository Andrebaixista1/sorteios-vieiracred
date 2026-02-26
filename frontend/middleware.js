const ALLOWED_IP = '45.224.161.116'

function getClientIp(request) {
  const headerNames = [
    'x-forwarded-for',
    'x-real-ip',
    'x-vercel-forwarded-for',
    'cf-connecting-ip',
  ]

  for (const headerName of headerNames) {
    const rawValue = request.headers.get(headerName)
    if (!rawValue) continue

    const candidate = rawValue.split(',')[0].trim()
    if (candidate) return candidate
  }

  return ''
}

function isLocalIp(ip) {
  return ip === '127.0.0.1' || ip === '::1'
}

export default function middleware(request) {
  const clientIp = getClientIp(request)

  if (clientIp === ALLOWED_IP || isLocalIp(clientIp)) {
    return
  }

  return new Response(
    `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Acesso bloqueado</title>
    <style>
      body { margin:0; font-family:system-ui,sans-serif; background:#050816; color:#fff; display:grid; place-items:center; min-height:100vh; }
      .card { width:min(92vw,560px); background:#0f1730; border:1px solid #2d3f78; border-radius:16px; padding:24px; }
      h1 { margin:0 0 12px; font-size:28px; }
      p { margin:6px 0; color:#c7d2fe; }
      code { color:#ffd166; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>IP nao permitido</h1>
      <p>Este site esta restrito para um IP especifico.</p>
      <p>Seu IP detectado: <code>${clientIp || 'nao identificado'}</code></p>
      <p>IP permitido: <code>${ALLOWED_IP}</code></p>
    </div>
  </body>
</html>`,
    {
      status: 403,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      },
    },
  )
}

export const config = {
  matcher: ['/((?!favicon.ico).*)'],
}

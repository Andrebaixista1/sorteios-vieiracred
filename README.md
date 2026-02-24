# sorteios-vieiracred

Projeto com `frontend` (React/Vite) e `backend` (Laravel) para sorteios da Vieiracred.

## Estrutura

- `frontend/` - painel de configuração e página de funcionamento
- `backend/` - API de configuração, tokens e validação

## Deploy (Vercel)

Para deploy do frontend no Vercel:

- selecione o branch `frontend`
- framework: `Vite`
- Root Directory: `/` (porque o branch `frontend` contém só os arquivos do frontend)
- variável de ambiente: `VITE_API_BASE` apontando para a URL pública da API

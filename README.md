# ACIESC Eventos

Plataforma de eventos da ACIESC (`eventos.aciesc.com.br`). Especificação completa e decisões em [CLAUDE.md](CLAUDE.md).

## Rodar localmente

Requer Node 20.9+ e Docker.

```bash
npm install
npm run db:start            # Supabase local
cp .env.example .env.local  # preencha a PUBLISHABLE_KEY de `npx supabase status -o env`
npm run dev                 # http://localhost:3000
```

E-mails de login (link mágico) chegam no Mailpit local: http://127.0.0.1:54324.

Para dar acesso ao painel a um usuário local:

```bash
docker exec supabase_db_aciesc-eventos psql -U postgres -c \
  "insert into public.user_roles (user_id, role) select id, 'admin' from auth.users where email = 'voce@exemplo.com';"
```

## Produção (Supabase remoto)

1. `npx supabase link --project-ref <ref>` e `npx supabase db push` (aplica as migrations).
2. Edge Functions: `npx supabase functions deploy` e `npx supabase secrets set --env-file supabase/functions/.env` (modelo em `supabase/functions/.env.example`).
3. Vault (SQL Editor): `select vault.create_secret('https://<ref>.supabase.co', 'project_url'); select vault.create_secret('<mesmo CRON_SECRET>', 'cron_secret');` — habilita o envio de mensagens e o rebuild automático.
4. Auth → URL Configuration: Site URL `https://eventos.aciesc.com.br` e redirect `https://eventos.aciesc.com.br/auth/callback/**`. SMTP próprio (Resend) para os e-mails de login.
5. Configurações no painel (`/admin/configuracoes/`): `site_url`, WhatsApp de ajuda, assinatura do certificado etc.
6. Primeiro admin: entre no site uma vez e rode `insert into public.user_roles (user_id, role) select id, 'admin' from auth.users where email = '...';`.

## Verificações

`npm run lint` · `npm run typecheck` · `npm test` · `npm run test:db`

## Deploy (KingHost)

O site é estático: `npm run build` gera `out/`, que é enviado por FTP pelo workflow `.github/workflows/deploy.yml` (push na `main`, execução manual ou `repository_dispatch` do tipo `rebuild`). Configure no GitHub os secrets `FTP_HOST`, `FTP_USER`, `FTP_PASSWORD` e as variables `FTP_DIR`, `SITE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`.

Para testar localmente como em produção: `npm run build && npm run preview:static` (http://localhost:3001).

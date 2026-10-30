@AGENTS.md

# ACIESC Eventos — Especificação para desenvolvimento (Claude Code)

> Documento de referência do projeto. Leia **inteiro** antes de escrever código. Em caso de dúvida de regra de negócio, **pergunte** — não invente.

---

## 0. Como trabalhar neste projeto (instruções para o Claude Code)

1. **Não invente** regra de negócio, preço, texto jurídico, nome de campo de API externa ou versão de biblioteca. Itens marcados como `[DECISÃO PENDENTE]` devem virar configuração ou ficar bloqueados até resposta.
2. Trabalhe em **etapas pequenas** (uma fase da seção 12 por vez). Ao fim de cada etapa: rode testes, lint e typecheck, e descreva o que foi feito em 3–5 linhas.
3. **Toda alteração de banco é migration versionada** (`supabase/migrations`). Nunca altere o banco de produção manualmente.
4. **Segurança antes de funcionalidade** (seção 9): RLS em todas as tabelas, chaves secretas só no servidor, webhooks com verificação de assinatura.
5. Use as **bibliotecas estáveis atuais** e confira a documentação oficial antes de usar APIs (Next.js, Supabase, gateway de pagamento). Não confie em memória para assinaturas de API. O Next.js deste projeto traz a documentação em `node_modules/next/dist/docs/` — leia-a antes de usar uma API do Next.
6. Antes de adicionar uma dependência, verifique manutenção ativa, licença e se não há alternativa nativa. Registre a decisão no PR.
7. Textos da interface em **português do Brasil**. Código, nomes de tabelas e variáveis em inglês (snake_case no banco, camelCase no TS).
8. Prefira **lógica de preço, estoque e lotes no servidor** (funções Postgres / Edge Functions). O front nunca decide preço.

### 0.1 Comandos

| Comando | O que faz |
|---|---|
| `npm run db:start` | Sobe o Supabase local (Docker). Se travar no health check: `npx supabase start --ignore-health-check -x vector,logflare,studio,imgproxy,edge-runtime` |
| `npm run db:reset` | Recria o banco local aplicando todas as migrations |
| `npm run dev` | Next.js em http://localhost:3000 (e-mails locais em http://127.0.0.1:54324 — Mailpit) |
| `npm run lint` · `npm run typecheck` · `npm test` · `npm run test:db` | Lint, tipos, testes unitários (Vitest) e testes de banco (pgTAP em `supabase/tests/database`) |
| `npx deno check supabase/functions/*/index.ts` | Tipos das Edge Functions |
| `npx supabase gen types typescript --local > src/lib/database.types.ts` | Regenerar tipos após mudar o banco |
| `npm run build` | Gera o site estático em `out/` (é exatamente isso que vai para a KingHost) |
| `npm run preview:static` | Serve `out/` em http://localhost:3001 para testar como em produção |

### 0.2 Arquitetura: site estático + Supabase (decidido em 30/10/2026)

Mapa do código:
- `supabase/migrations/` — schema, RLS e toda a regra de negócio (preço, lotes, reserva, checkout, check-in, lista de espera, presença, faltas, certificados, jobs `pg_cron`, fila de mensagens).
- `supabase/functions/` — Edge Functions (Deno): `process-outbox` (e-mail via Resend; WhatsApp via `MessagingProvider`), `payments` e `payment-webhook` (`PaymentProvider`), `request-rebuild` (GitHub `repository_dispatch`).
- `supabase/tests/database/` — testes pgTAP (RLS, preço, lotes, checkout, capacidade, check-in, webhook).
- `src/app/` — páginas públicas (`/`, `/e/[slug]/`, `/evento/?s=`, `/checkout/?r=`, `/pedido/?id=`, `/meus-ingressos/`, `/presenca/?t=`, `/lista-espera/?t=`, `/certificado/?c=`, `/validar/?c=`) e painel (`/admin/…`).
- `src/lib/` — cliente Supabase, auth, formatação, CSV, CPF, prévia de preço (espelho do servidor só para exibição).
O site é um **export estático** do Next.js (`output: "export"`, pasta `out/`) servido pelo Apache da KingHost, **sem Node.js** (o add-on Node da KingHost é pago e a Vercel grátis proíbe uso comercial). Consequências — obrigatórias para todas as fases:
- **Não existe servidor Next.** Proibido usar: Server Actions, Route Handlers com Request, `cookies()`/`headers()`, `proxy.ts`, ISR, rewrites/redirects/headers do `next.config`, `next/image` com loader padrão, rotas dinâmicas sem `generateStaticParams`.
- **Toda regra de negócio e todo segredo ficam no Supabase:** RLS, funções Postgres (RPC) e Edge Functions (webhooks de pagamento, envio de e-mail/WhatsApp, rate limit de CPF/cupom, assinatura HMAC do QR, jobs). O navegador só usa a chave publicável.
- **A checagem de papel no front é só para exibição.** Quem autoriza de verdade é o RLS/RPC. Nunca confie no cliente para preço, estoque ou permissão.
- **Páginas públicas com SEO** (`/e/[slug]`): geradas no build via `generateStaticParams`, buscando eventos publicados no Supabase. Ao publicar/alterar um evento, o Supabase dispara `repository_dispatch` (tipo `rebuild`) no GitHub e o workflow `deploy.yml` reconstrói e envia por FTP. Dados vivos (vagas, lote atual, preço) são buscados no navegador.
- **Rotas com parâmetros privados** (pedido, checkout, ingresso) usam query string ou hash em páginas fixas (ex.: `/pedido/?id=...`), não segmentos dinâmicos.
- URLs com barra final (`trailingSlash: true`): `/admin/` vira `out/admin/index.html`.
- Supabase no navegador via `@supabase/supabase-js` (`src/lib/supabase/client.ts`): sessão em localStorage, login PKCE. Use `auth.getUser()` (valida no servidor de Auth), não só `getSession()`.
- Acesso a usuário/papéis só por `src/lib/auth.ts` (`useCurrentUser`, `loadCurrentUser`, `hasAnyRole`, `safeNext`).
- Deploy: `.github/workflows/deploy.yml` (push na main, manual ou `repository_dispatch`) → `npm run build` → FTP (lftp com TLS) para a KingHost. Configurar no GitHub: secrets `FTP_HOST`, `FTP_USER`, `FTP_PASSWORD`; variables `FTP_DIR`, `SITE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`. `public/.htaccess` define HTTPS, 404 e cabeçalhos de segurança.
- Funções auxiliares de RLS ficam no schema `private` (não exposto pela API): `private.is_admin()`, `private.has_role(role, event_id)`, `private.audit(...)`.
- Toda tabela nova: `enable row level security` + políticas explícitas + teste pgTAP cobrindo anon, participante, door, organizer e admin.

---

## 1. Contexto

- **Cliente:** ACIESC — Associação de Corretores e Imobiliárias do Estado de Santa Catarina (Itapema/SC). Site institucional: aciesc.com.br.
- **Objetivo:** plataforma própria de eventos estilo Sympla para cursos, palestras, workshops e eventos da ACIESC, substituindo o uso do Sympla.
- **Público:** corretores de imóveis, imobiliárias e construtoras de SC. Maioria acessa pelo **celular**.
- **Foco de uso:** muitos **cursos gratuitos para associados**, além de eventos pagos e eventos gratuitos abertos.
- **Domínio de produção:** `https://eventos.aciesc.com.br`
- **Sem taxas:** a plataforma **não cobra taxa de serviço do comprador**. O valor exibido é o valor pago. Custos do gateway de pagamento são absorvidos pela ACIESC.
- **Protótipo navegável (referência visual e de fluxo):** https://claude.ai/artifact/23zBnoME8wy4okySU2DSYX (Design canvas, páginas "Jornada do comprador" e "Painel do organizador"). Se não abrir, peça ao responsável o compartilhamento ou capturas de tela.

### 1.1 Alternativa avaliada e descartada
O projeto open source **Hi.Events** (Laravel + React, AGPL com termos adicionais) foi avaliado. Descartado porque: pagamento só via Stripe (Pix para conta brasileira é restrito), exige manter "Powered by" ou licença paga, stack PHP fora do Supabase. Decisão: **construção própria em Next.js + Supabase**, usando o Hi.Events/Sympla apenas como referência de funcionalidades.

---

## 2. Stack e infraestrutura

| Camada | Escolha | Observação |
|---|---|---|
| Front | Next.js (App Router) + TypeScript, **export estático** | Páginas públicas pré-renderizadas no build (SEO); ver 0.2 |
| Estilo | Tailwind CSS | Tokens da seção 3 (em `src/app/globals.css`) |
| Banco, Auth, Storage | Supabase (Postgres + RLS + Auth + Storage) | Projeto na conta **aciescoficial@gmail.com**. **Por ora só local** (`supabase start`); projeto remoto a definir |
| Lógica sensível | Funções Postgres (`security definer` com cuidado) + Supabase Edge Functions | Preço, reserva de estoque, virada de lote, webhooks |
| Jobs agendados | `pg_cron` (Supabase) ou Edge Function agendada | Virada de lote por data, lembretes, liberação de vagas, certificados |
| Hospedagem | **KingHost** (revenda onde já está aciesc.com.br), só arquivos estáticos | Decidido. Sem add-on Node (custo extra). Deploy por FTP via GitHub Actions. `[A VERIFICAR]` Apache com `mod_rewrite`/`mod_headers` e FTP com TLS. DNS: subdomínio `eventos` no painel KingHost |
| Pagamento | Gateway brasileiro com Pix + cartão até 12x | `[DECISÃO PENDENTE]` Asaas **ou** Mercado Pago. Implementar atrás de uma interface `PaymentProvider` |
| E-mail transacional | Resend | Domínio remetente verificado (ex.: `eventos@aciesc.com.br`) |
| WhatsApp | API oficial do WhatsApp (via HUB7 ou Meta Cloud API) com modelos aprovados | `[DECISÃO PENDENTE]` provedor. Implementar atrás de uma interface `MessagingProvider` |
| Mapas | Link Google Maps / Waze + embed | Sem chave obrigatória no MVP |

### 2.1 Ambientes
- `dev` (local, `supabase start`), `staging` (projeto/branch Supabase + pasta/subdomínio de homologação na KingHost), `prod`.
- Variáveis em `.env.local` / painel da hospedagem. **Nunca** commitar `.env`. Fornecer `.env.example`.
- Gateway e WhatsApp em **modo sandbox/teste** em dev e staging.

---

## 3. Identidade visual (seguir aciesc.com.br)

- **Fonte:** Poppins (400, 500, 600, 700, 800, 900; itálico 600–800).
- **Cores (tokens):**
  - `--green-900: #0A1F1A` (rodapé, menus escuros)
  - `--green-800: #0B2E25` · `--green-700: #0F4434` · `--green-600: #13604A` (degradê do cabeçalho e heros: `linear-gradient(90deg, #0B2E25, #0F4434 55%, #13604A)`)
  - `--brand: #256958` (cor do logo vetorial oficial)
  - `--accent: #3BE58A` → `#1FC46A` (botão principal em degradê, texto do botão `#062A1C`)
  - `--ink: #14201C` · `--muted: #55625D` · `--line: #DDE3E0` · `--bg: #F6F8F7` · `--tint: #EAF2EF`
  - Status: pendente `#FFF4DB`/`#6B4600`; erro `#FDECEA`/`#8A1C12`
- **Botão principal:** pílula (border-radius 999px), degradê verde-vivo, texto escuro, sombra verde suave (utilitário `btn-primary`).
- **Títulos de destaque:** caixa alta, peso 800–900, palavra-chave em itálico verde (`#3BE58A`) sobre fundo escuro.
- **Logo:** versão branca no cabeçalho escuro; versão verde em fundo claro (certificado). Arquivos SVG estão no Google Drive da ACIESC ("ACIESC - LOGO - VERDE.svg").
- **Acessibilidade:** contraste mínimo 4.5:1, alvos de toque ≥ 44px, navegação por teclado, `label` em todos os campos, mobile-first.

---

## 4. Perfis de pessoa (vínculo) — conceito central

Toda pessoa é identificada pelo **CPF** e tem um vínculo com a ACIESC:

| Vínculo | O que é | Fonte da verdade |
|---|---|---|
| **Associado** | Paga anuidade; status ativo/vencido | Situação da anuidade vem do **Hi Gestor** (sistema atual da ACIESC) |
| **Adepto** | Modalidade **gratuita** de fazer parte da ACIESC | Cadastro na plataforma (Base ACIESC) |
| **Outro** | Sem vínculo (público geral) | — |

Regras:
- No checkout, o CPF determina o vínculo e, portanto, o preço. O vínculo é **validado no servidor**; o seletor de vínculo da página do evento é só informativo.
- Associado com anuidade **vencida** é tratado como **adepto** `[DECISÃO PENDENTE: confirmar regra e prazo]`.
- Quem não tem vínculo vê no checkout a opção **"Quero ser Adepto ACIESC — gratuito"**; ao marcar, vira adepto (com aceite registrado: data/hora/IP/versão dos termos) e já paga o preço de adepto nessa compra `[DECISÃO PENDENTE: confirmar]`.
- A **Base ACIESC** (cadastro único no Supabase) é a fonte de verdade de pessoas, adeptos e histórico de eventos. O Hi Gestor só informa a situação da anuidade.

### 4.1 Integração Hi Gestor
- `[DECISÃO PENDENTE]` Verificar com o suporte do Hi Gestor se existe API de leitura (e escrita) de associados/anuidade.
- **Enquanto não houver API:** importação de CSV (CPF, nome, e-mail, telefone, CRECI, situação, validade) pelo painel, com prévia e relatório de inconsistências. Registrar `last_synced_at`.
- Nunca sobrescrever dados de adepto com dados do Hi Gestor sem regra explícita.

---

## 5. Modelo de ingressos, preço por perfil e lotes

Estrutura: **Evento → Datas (turmas/sessões) → Tipos de ingresso → Lotes**, e cada tipo de ingresso tem uma **regra de preço por perfil**.

### 5.1 Tipos de ingresso
Ex.: "Ingresso individual", "Pacote imobiliária (5 pessoas)", "Acompanhante", "Estudante TTI". Campos: nome, descrição, pessoas por ingresso (1 ou N participantes nomeados), visível/oculto, limite por pedido, ordem.

### 5.2 Regra de preço por perfil (por tipo de ingresso)
Para cada perfil (`associado`, `adepto`, `outro`) um modo:

| Modo | Preço final |
|---|---|
| `free` | 0 (gratuito) |
| `percent` | `valor_do_lote × (1 − pct/100)`, arredondado para centavos (half-up) |
| `fixed` | valor fixo informado |
| `full` | valor do lote (preço normal) |
| `blocked` | perfil **não pode** comprar este tipo |

Opcional: **vagas reservadas por perfil** (ex.: 40 vagas só para associados).

Exemplos que o sistema deve suportar:
- *Aniversário ACIESC 3 anos (100% gratuito):* associado `free`, adepto `free`, outro `free`.
- *Curso Lead Milionário:* associado `free`, adepto `percent 50`, outro `full`.

### 5.3 Lotes (por tipo de ingresso)
Campos: nome, `base_price` (valor normal; 0 = gratuito), quantidade, gatilho de virada, parâmetro, status (`scheduled`, `active`, `closed`).

Gatilhos de virada para o próximo lote:
- `quantity` — quando vendidos ≥ quantidade do lote.
- `date` — na data/hora definida (fuso America/Sao_Paulo).
- `manual` — botão "Virar lote agora" no painel.

Regras:
- Apenas **um lote ativo** por tipo de ingresso por data.
- Virada é **atômica** e registrada em auditoria (quem, quando, motivo: quantidade/data/manual).
- Virada por data via job agendado (a cada minuto) **e** verificação no momento da compra.

### 5.4 Cálculo de preço (servidor)
Função única `compute_price(ticket_type_id, lot_id, tier, coupon_code?)` usada pelo checkout e pela página do evento. Ordem: regra do perfil → cupom (se aplicável, `[DECISÃO PENDENTE]` se cupom acumula com desconto de perfil) → nunca negativo. **Sem taxa de serviço.**

### 5.5 Estoque e reserva
- Ao iniciar o checkout, criar **reserva** com expiração de **15 minutos** (contador visível ao comprador).
- Reserva e confirmação via função Postgres com bloqueio de linha (`SELECT ... FOR UPDATE`) para não vender acima da capacidade.
- Reservas expiradas liberam estoque automaticamente (job + verificação na leitura).

---

## 6. Funcionalidades — comprador (site público)

Rotas sugeridas (ajuste se necessário):

| Rota | Tela | Pontos-chave |
|---|---|---|
| `/` | Vitrine | Busca + filtro de cidade; carrossel de destaques; categorias; fileiras ("Cursos gratuitos para associados", "Mais procurados"); faixa "Associe-se / Virar adepto grátis"; cidades; FAQ |
| `/e/[slug]` | Página do evento | Hero escuro com título, datas, horário, endereço (link mapa), selos, arte do evento, compartilhar; descrição com "ver mais"; caixa fixa "Ingressos entre R$ X e R$ Y"; bloco de ingressos: abas de data, seletor de vínculo informativo, subtotal, cupom, cards de ingresso com contador, preço normal riscado quando há desconto, barra de lote, "ver detalhes"; formas de pagamento; ajuda (WhatsApp) |
| `/checkout/[reservationId]` | Checkout | Dados do comprador; CPF → verificação de vínculo (associado/adepto/sem vínculo + opção virar adepto); participante por ingresso (nome no certificado, CPF, e-mail, CRECI opcional); pagamento Pix ou cartão (até 12x); aceite de termos/privacidade; opt-in WhatsApp |
| `/pedido/[id]` | Pagamento Pix / confirmação | QR Code + copia e cola, expiração, atualização em tempo real (Supabase Realtime) ao receber webhook; tela de confirmação |
| `/meus-ingressos` | Área do participante | Próximos, anteriores, certificados (horas acumuladas); QR do ingresso; baixar PDF; adicionar à agenda; transferir titularidade `[DECISÃO PENDENTE: regra]`; cancelar `[DECISÃO PENDENTE: política]` |
| `/validar/[codigo]` | Validação pública de certificado | Mostra nome, curso, carga horária, data; sem dados sensíveis |

Login do participante: **link mágico por e-mail** (Supabase Auth) e/ou código por WhatsApp `[DECISÃO PENDENTE]`. Compra possível sem conta prévia (conta criada pelo e-mail no checkout). A Fase 1 já entrega o link mágico por e-mail em `/entrar`.

SEO: metatags e Open Graph por evento (imagem da arte), `sitemap.xml`, dados estruturados `Event` (schema.org).

---

## 7. Funcionalidades — organizador (painel `/admin`)

Papéis: `admin` (tudo), `organizer` (eventos e participantes), `door` (portaria: só check-in do evento atribuído), `finance` (financeiro, leitura). Controle no banco via RLS + tabela de papéis (`public.user_roles`).

| Rota | Tela | Pontos-chave |
|---|---|---|
| `/admin` | Início | Criar curso gratuito / evento presencial / online; KPIs; "Meus eventos" com abas Próximos, Rascunhos, Encerrados; status, inscritos/capacidade, Gerenciar |
| `/admin/dados` | Dados | Período; inscrições (gratuitas/pagas); comparecimento (check-in ÷ inscritos); certificados e horas; inscritos × presentes por evento; aparelho; horário de pico; origem (UTM); ranking; associados que nunca participaram (exportar) |
| `/admin/eventos/novo` | Criar evento (4 etapas) | 1) tipo (curso gratuito p/ associados, pago, gratuito aberto), nome, categoria, capa, descrição, palestrantes, certificado e carga horária · 2) presencial/online/híbrido, datas/turmas, local salvo · 3) **ingressos por perfil e lotes** (seção 5) com atalhos e prévia "o que cada perfil paga" · 4) perguntas ao participante, mensagens automáticas, visibilidade (aberto a todos / só associados / associados e adeptos / privado). Rascunho salvo automaticamente |
| `/admin/eventos/[id]` | Painel do evento | Visão geral (vagas, lista de espera, presença confirmada, check-in), regras do curso gratuito (seção 8), automações, inscritos por perfil; Ingressos; Comunicação; Certificados; Divulgue (links UTM por canal); Financeiro |
| `/admin/eventos/[id]/participantes` | Participantes e check-in | Check-in online (busca, filtros, desfazer); leitor USB (campo de leitura com foco permanente); crachás/etiquetas (linhas configuráveis, PDF A4 10/16/21 por folha, térmica, A6); lista de espera (oferecer vaga, expiração) |
| `/admin/portaria` | App de check-in (PWA mobile) | Câmera lê QR; resultados: liberado / já utilizado / pagamento pendente / outro evento / inválido; **funciona offline** com lista baixada e sincroniza depois |
| `/admin/base` | Base ACIESC | Filtro por vínculo (associado, anuidade vencida, adepto, outro); busca por nome/CPF/CRECI/e-mail; participação (nunca foi, 1–2, 3+, faltou no último); funil outro → adepto → associado; ações (convidar a associar, cobrar renovação, convidar a ser adepto); sincronizar Hi Gestor |
| `/admin/base/[pessoaId]` | Ficha da pessoa | Dados, vínculo e origem, estatísticas (inscrições, presenças, faltas, % presença, horas), eventos (inscrito como, valor, resultado), certificados, histórico do vínculo |

Migração do Sympla: importar CSV de eventos e participantes antigos (O futuro do mercado imobiliário passa pela legalidade — 06/08/2026; Treinamento para corretores — 05/08/2025; Workshop para corretores — 11/09/2024; Festa do Corretor e Lançamento ACIESC — 26/08/2024) para alimentar a Base ACIESC e o histórico.

---

## 8. Regras dos cursos gratuitos (configuráveis por evento)

Cada regra é um interruptor no painel do evento:
1. **Vagas gratuitas só para associados ativos** (adepto e outro pagam conforme regra de perfil, ou ficam bloqueados).
2. **Uma inscrição por CPF** por evento/data.
3. **Confirmação de presença 48h antes** via WhatsApp com botões "Confirmo" / "Não vou poder ir".
4. **Liberar vagas não confirmadas 24h antes** → oferecer ao próximo da **lista de espera**, que tem **4h para aceitar** (por WhatsApp/e-mail com link).
5. **Exigir check-in de saída** para emitir certificado (opcional).
6. **Registrar falta** de quem não comparece nem cancela; após **2 faltas no semestre**, a pessoa vai para o fim da fila nos próximos cursos `[DECISÃO PENDENTE: confirmar regra]`.

Lista de espera: ordem por data de entrada; estados `waiting` → `offered` (com `expires_at`) → `accepted` / `expired` / `removed`.

### 8.1 Certificados
- Emitidos para quem fez check-in (e check-out, se exigido), no dia seguinte às 9h (job) ou manualmente.
- PDF com logo, nome do participante, evento, data, carga horária, assinatura `[DECISÃO PENDENTE: quem assina / imagem da assinatura]` e **código de validação** único (link `/validar/[codigo]`).
- Modelo customizável (upload de arte de fundo).

### 8.2 Mensagens automáticas (WhatsApp + e-mail)
Ingresso após inscrição/pagamento · confirmação de presença 48h antes · lembrete 2h antes (endereço, mapa, estacionamento) · aviso de vaga liberada (lista de espera) · certificado + pesquisa no dia seguinte. Envio manual para segmentos (não confirmaram, todos, lista de espera, presentes, faltantes). Registrar cada envio (status, erro) para auditoria e para não duplicar.

---

## 9. Segurança, privacidade (LGPD) e confiabilidade

- **RLS habilitado em todas as tabelas.** Políticas explícitas por papel. Testes automatizados de RLS (usuário anônimo, participante, organizer, door, admin).
- Chave secreta (`service_role` / secret key) **somente** em Edge Functions (`supabase secrets set`). O site estático só conhece a chave publicável; tudo com prefixo `NEXT_PUBLIC_` vai para o navegador.
- **Webhooks do gateway:** verificar assinatura/token; idempotência por `event_id`; nunca confirmar pagamento por retorno do navegador, só por webhook ou consulta servidor-servidor.
- **QR Code do ingresso:** conteúdo assinado (HMAC com segredo do servidor) + ID; o app de portaria valida assinatura e estado. Um ingresso só faz check-in uma vez (desfazer exige papel `organizer`).
- **CPF:** validar dígitos; armazenar normalizado; exibir mascarado (`***.456.789-**`) fora da ficha da pessoa; não expor CPF em URLs. Utilitários em `src/lib/cpf.ts`.
- **LGPD:** aceite de termos e privacidade com versão e data; opt-in separado para WhatsApp de divulgação; exportação e exclusão de dados a pedido do titular (painel admin); minimizar dados coletados.
- **Rate limit** em verificação de CPF, login, cupom e criação de reserva (evitar enumeração de associados).
- **Auditoria:** tabela `audit_log` para viradas de lote, check-ins desfeitos, alterações de preço, importações Hi Gestor, mudanças de vínculo, envios em massa, concessão/revogação de papéis.
- **Dados de cartão:** nunca trafegam/armazenam no nosso servidor (tokenização/checkout do gateway).
- Backups: confirmar política de backup do plano Supabase antes do lançamento.
- Antes de cada fase ir a produção: rodar os *advisors* de segurança e performance do Supabase e corrigir alertas.

---

## 10. Modelo de dados (ponto de partida — refine nas migrations)

```
people            (id, cpf unique, full_name, email, phone, creci, company, city, created_at, ...)
memberships       (id, person_id, tier[associate|adept|other], status[active|expired|none],
                   valid_until, source[higestor|platform|import], adept_since, terms_version,
                   terms_accepted_at, last_synced_at)
membership_events (id, person_id, from_tier, to_tier, reason, created_at)          -- histórico do vínculo
users / roles     (auth.users + user_roles(user_id, role, event_id null))          -- FEITO (Fase 1)
venues            (id, name, address, city, lat, lng)
events            (id, slug unique, title, kind[free_course|paid|open_free], category, description,
                   cover_path, format[in_person|online|hybrid], venue_id, online_url,
                   visibility[public|associates|associates_adepts|private], certificate_hours,
                   status[draft|published|closed|cancelled], rules jsonb, created_by, ...)
event_dates       (id, event_id, starts_at, ends_at, capacity)
speakers          (id, event_id, name, bio, photo_path)
ticket_types      (id, event_id, name, description, people_per_ticket, max_per_order, visible, sort)
tier_rules        (id, ticket_type_id, tier, mode[free|percent|fixed|full|blocked], value, reserved_seats)
lots              (id, ticket_type_id, event_date_id, name, base_price, quantity,
                   trigger[quantity|date|manual], trigger_at, status[scheduled|active|closed], sort)
coupons           (id, event_id, code, kind[percent|fixed], value, max_uses, used, valid_until)
reservations      (id, event_date_id, buyer_email, expires_at, status[open|converted|expired])
orders            (id, reservation_id, buyer_person_id, total, payment_method[pix|card|free],
                   installments, provider, provider_ref, status[pending|paid|failed|refunded|cancelled],
                   utm_source, utm_medium, utm_campaign, device, created_at, paid_at)
order_items       (id, order_id, ticket_type_id, lot_id, tier_applied, unit_price, quantity)
tickets           (id, order_item_id, attendee_person_id, code unique, qr_signature,
                   status[valid|used|cancelled|transferred], presence_confirmed[null|yes|no])
checkins          (id, ticket_id, kind[in|out], at, by_user_id, device_id, offline bool)
waitlist          (id, event_date_id, person_id, position, status, offered_at, expires_at)
absences          (id, person_id, ticket_id, event_date_id, created_at)
certificates      (id, ticket_id, code unique, hours, issued_at, pdf_path)
form_questions    (id, event_id, label, type, required, options)
form_answers      (id, ticket_id, question_id, value)
messages_log      (id, person_id, ticket_id, channel[whatsapp|email], template, status, error, sent_at)
audit_log         (id, actor_user_id, action, entity, entity_id, data jsonb, created_at)  -- FEITO (Fase 1)
```

Funções/RPC essenciais: `lookup_tier(cpf)`, `compute_price(...)`, `create_reservation(...)`, `confirm_order(order_id)` (chamada pelo webhook), `turn_lot(lot_id, reason)`, `checkin(ticket_code, signature, kind)`, `offer_waitlist_seat(event_date_id)`.

Pendência da Fase 3: adicionar FK `user_roles.event_id → events.id`.

---

## 11. Pagamentos (sem taxa)

- Métodos: **Pix** (aprovação imediata, expiração 15 min) e **cartão de crédito em até 12x** `[DECISÃO PENDENTE: até quantas parcelas sem juros]`.
- Pedido **gratuito** (total 0) não passa pelo gateway: confirma direto e emite ingresso.
- Interface `PaymentProvider` com: `createPixCharge`, `createCardCharge`, `getPayment`, `refund`, `verifyWebhook`.
- Reembolso pelo painel (total ou parcial), conforme política `[DECISÃO PENDENTE]`.
- Financeiro no painel: vendas totais, em processamento, canceladas/reembolsadas por evento; o dinheiro cai direto na conta da ACIESC no gateway.

---

## 12. Fases de entrega (ordem sugerida)

1. **Fundação:** repositório, Next.js + Tailwind com tokens visuais, Supabase (dev/staging), Auth, papéis, RLS base, CI (lint, typecheck, testes), deploy de homologação na KingHost, domínio `eventos.aciesc.com.br` em staging.

> **Situação em 30/10/2026:** fases 1 a 9 implementadas e testadas localmente. Bloqueado por decisões externas: gateway (#1 — `PaymentProvider` sem implementação, pagamento online desligado em `payments_enabled`), WhatsApp (#2 — mensagens ficam como "não enviadas"), textos de termos/privacidade, SVG do logo, assinatura do certificado (#11). Falta para produção: projeto Supabase remoto, secrets das Edge Functions, segredos do Vault para o cron (`project_url`, `cron_secret`), credenciais FTP e variáveis no GitHub, subdomínio, advisors do Supabase (fase 10).
2. **Base ACIESC:** pessoas, vínculos, importação CSV do Hi Gestor, ficha da pessoa, busca/filtros.
3. **Eventos e ingressos:** criar evento (4 etapas), tipos de ingresso, regras por perfil, lotes e viradas, prévia de preços; vitrine e página do evento (somente leitura).
4. **Inscrição gratuita:** checkout sem pagamento, vínculo por CPF, virar adepto, ingresso com QR, e-mail; "Meus ingressos".
5. **Pagamentos:** gateway (sandbox), Pix com Realtime, cartão, webhooks idempotentes, reserva com expiração.
6. **Check-in:** lista online, leitor USB, PWA de portaria offline, crachás/etiquetas em PDF.
7. **Cursos gratuitos:** confirmação de presença, lista de espera, faltas, automações WhatsApp.
8. **Certificados:** emissão, PDF, validação pública.
9. **Dados e Divulgue:** dashboard, UTM, exportações, migração do histórico do Sympla.
10. **Lançamento:** revisão de segurança (advisors Supabase, testes de RLS), testes de carga do checkout, LGPD, produção.

**Critério de pronto de cada fase:** testes passando (unitários para preço/lotes/estoque; e2e para fluxo de compra e check-in), RLS testado, sem segredos no cliente, mobile verificado em 390px, textos revisados em pt-BR.

---

## 13. Decisões pendentes (resolver com a diretoria antes da fase indicada)

| # | Decisão | Fase | Status |
|---|---|---|---|
| 1 | Gateway: Asaas ou Mercado Pago | 5 | Pendente |
| 2 | Provedor WhatsApp (HUB7 ou Meta Cloud API direto) e modelos de mensagem | 7 | Pendente |
| 3 | Hi Gestor tem API? Leitura/escrita? | 2 | Pendente |
| 4 | Associado com anuidade vencida vira adepto? Após quantos dias? | 2 | Pendente |
| 5 | Benefícios do adepto; quem vira adepto no checkout já paga preço de adepto? | 4 | Pendente |
| 6 | Cursos gratuitos abertos a adeptos ou só associados (padrão por evento) | 3 | Pendente |
| 7 | Regra de faltas (2 faltas/semestre → fim da fila?) | 7 | Pendente |
| 8 | Política de cancelamento, reembolso e transferência de titularidade | 5 | Pendente |
| 9 | Cupom acumula com desconto de perfil? | 3 | Pendente |
| 10 | Parcelas sem juros no cartão | 5 | Pendente |
| 11 | Assinatura e modelo do certificado | 8 | Pendente |
| 12 | Hospedagem | 1 | **Decidido: KingHost, site estático (R$ 0)**. Node da KingHost é pago; Vercel Hobby proíbe uso comercial (venda de ingresso) |
| 13 | Login do participante: link por e-mail, código por WhatsApp ou ambos | 4 | Pendente (link por e-mail já implementado como base) |
| 14 | Projeto Supabase remoto: novo na conta aciescoficial ou reaproveitar existente | 1 (staging) | Pendente — por ora só local |

---

## 13.1 Premissas adotadas na implementação (confirmar com a diretoria)

- **Perfil para preço:** em ingresso individual vale o CPF de cada participante; em pacote (N pessoas) vale o CPF do comprador.
- **Cupom sem acúmulo** (`coupon_stacks_with_tier = false`): aplica-se ao valor do lote e o participante paga o menor entre o preço do perfil e o preço com cupom.
- **Regra "vagas gratuitas só para associados ativos":** bloqueia o modo "gratuito" para quem não é associado ativo.
- **Lista de espera:** oferece 1 vaga do primeiro ingresso individual com lote ativo; prazo configurável por evento (padrão 4h); quem já tem ingresso não entra.
- **Faltas:** registradas após o fim da data para quem não fez check-in; a penalidade "fim da fila" só vale com `absence_penalty_enabled = true`.
- **Cancelamento:** feito pela equipe no Financeiro; o estorno no gateway é manual até a política (#8) e o provider existirem. Transferência de titularidade ainda não implementada (#8).
- **Certificado em PDF:** gerado pelo navegador ("Salvar como PDF") a partir de `/certificado/?c=`.
- **Pedido Pix:** a tela do pedido consulta o status a cada 4s (em vez de Realtime), pois compradores não precisam estar logados.
- **Exclusão LGPD:** anonimiza nome, contatos e CPF (troca por CPF aleatório válido) mantendo os números agregados.

## 14. Fora do escopo do MVP
Venda de produtos (camiseta, boné), lugares marcados/mapa de assentos, app nativo (a portaria é PWA), multi-organizador externo (só a ACIESC publica eventos), transmissão de vídeo própria (usar link externo).

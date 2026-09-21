# Evolução incremental — 21/09/2026

## Diagnóstico antes das alterações

Base analisada: commit 16bf934. Next.js App Router 16, React 19, TypeScript, Tailwind, componentes existentes em components/ui, Supabase Auth e Postgres provisionados. API comercial usa Drizzle/libSQL e cai em SQLite temporário quando faltam variáveis. Interface única em app/page.tsx contém ingredientes, embalagens, receitas, produtos, vendas, despesas, simulador, relatórios, ranking de clientes e exportações. Preservar estas telas e seus contratos.

| Prioridade | Módulo | Causa e impacto | Correção planejada |
|---|---|---|---|
| Crítico | api/auth/login, crypto-auth | Senha ignorada; qualquer nome recebe administrador; segredo padrão no código | Supabase Auth como única autoridade; rejeitar tokens dm_ inseguros |
| Crítico | page.tsx persistência | Cache global no localStorage sem empresa; sincronização automática pode levar dados a outra conta | Banco como fonte; recuperar backup antigo somente por importação explícita |
| Crítico | db/index.ts | SQLite em diretório temporário; perda após reinício/serverless | Adaptar registros JSON existentes para Postgres por empresa, sem remover tabelas antigas |
| Alto | api/records | Falha retorna HTTP 200 vazio; auditoria sem await; importação parcial e IDs quebrados | Erros reais, transações, idempotência e mapa de referências |
| Alto | auth.ts | Empresa sem nome; escopo derivado de usuário quando falta ponte | stores/store_members existentes definem empresa e função |
| Alto | pricing.ts | Custo por grama arredondado a centavos; CMV inclui entrega/mão de obra | Precisão intermediária e CMV mercantil |
| Alto | receitas/produtos | Custos em snapshots; ingrediente alterado não atualiza dependências | Recalcular derivados por referências; vendas preservam custo histórico |
| Médio | validação | Rendimento ausente e negativos indevidos passam | Validação por tipo, unidades e percentuais |
| Médio | interface mobile | Controles pequenos e tabelas largas; salvar sem confirmação clara | Controles 44px, feedback de rede, navegação com precificação |
| Médio | configuração | ignoreBuildErrors oculta erros; testes antigos usam login ChatGPT | Checagem TypeScript e testes atualizados |

## Backup obrigatório antes de publicar

1. No navegador/dispositivo que contém os dados atuais, use Minha conta → Baixar cópia de segurança. Guarde o JSON sem modificá-lo. O cache legado mousse_persisted_records_v4 NÃO deve ser apagado antes da conferência.
2. Para libSQL/Turso configurado, exporte um dump pela ferramenta do provedor. Se usar SQLite local, pare escritas e copie o arquivo mousse_data.db com seus arquivos WAL/SHM ou use o comando .backup do SQLite. O arquivo temporário de uma instância da Vercel pode não ser recuperável: o JSON do navegador é essencial.
3. No Supabase, exporte schema e dados (supabase db dump e supabase db dump --data-only) ou use backup do painel antes da migration. Não versionar dumps com dados comerciais.
4. Migration aditiva: preservar profiles, stores, store_members e demais tabelas. Usar stores como empresa; não criar companies duplicada.
5. Importar backup autenticado como administrador, revisar a empresa de destino e confirmar. Repetição do mesmo arquivo deve ser idempotente. Não atribuir automaticamente dados locais de origem desconhecida.

Sessões Supabase existentes são preservadas. Tokens dm_ sem validação de senha não são sessões confiáveis e devem exigir novo login; usuários e registros não são excluídos.

## Publicação

Reutilizar https://github.com/malakasdev7/Mousse. Configurar SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY na Vercel; nunca enviar service_role ao frontend. Aplicar migration e funções revisadas antes do deploy. Executar testes e build. Importar o backup na empresa correta, validar em dois contextos de navegador e só então encerrar a migração operacional.

## Implementação concluída

- Autenticação: o login inseguro que aceitava qualquer senha foi removido. O Next.js usa a Edge Function `login-username`, Supabase Auth e cookies HttpOnly. Login, renovação, logout, alteração de senha e adoção segura de sessões Supabase antigas passam pelo servidor. E-mails internos, chave `service_role` e tokens não são enviados à interface.
- Empresa e permissões: `stores` e `store_members` continuam como fonte da empresa e função. O nome da empresa aparece no produto. A API rejeita gravação de `viewer` e exclusão por não administrador; RLS repete a proteção no Postgres.
- Dados: ingredientes, embalagens, despesas, receitas, produtos, vendas, fornecedores, cenários e configurações podem usar o adaptador durável `audit_records`, sempre com `store_id`. O navegador mantém apenas cache em memória; o cache legado só pode ser exportado/importado por ação explícita.
- Salvamento: a interface mostra “Salvando...”, só atualiza o estado após confirmação, mostra “Salvo na conta”, mantém o formulário quando há erro e usa chave de idempotência para impedir duplicação em repetição de rede.
- Migração: a restauração de JSON é atômica, limitada, exclusiva de administrador, idempotente por hash e remapeia referências de ingredientes, sub-receitas, receitas, embalagens e produtos. Nenhum dado antigo é atribuído automaticamente à empresa errada.
- Custos: precisão intermediária deixou de arredondar custo por grama/ml a centavos; margem é calculada sobre venda, taxas entram no denominador, CMV não inclui mão de obra/despesas fixas, percentuais impossíveis são bloqueados e vendas antigas mantêm snapshots.
- Ficha técnica: rendimento, peso, volume, custo por grama/ml/porção, perda, preparo, observações, versão e data de alteração são preservados. Receitas podem consumir sub-receitas reutilizáveis, com detecção de ciclos e recálculo encadeado.
- Produtos: referências estáveis de receita e embalagem evitam quebra por renomeação; sabor, tamanho/peso, canal, margem-alvo e alertas de custo desatualizado foram incorporados sem exigir recadastro dos produtos existentes.
- Mobile: navegação rápida prioriza simulador, produtos e vendas; controles têm alvo mínimo de 44 px, campos usam fonte de 16 px para evitar zoom e formulários técnicos podem ser recolhidos.
- Segurança operacional: mensagens externas são genéricas; detalhes do banco não vazam. Exclusões confirmam antes da chamada e registros em uso são protegidos.

## Banco e funções publicados

Migrations aditivas aplicadas ao projeto existente:

1. `20260921174533_company_records_safe.sql`: cria `audit_records`, índices, RLS, auditoria transacional e importação atômica. Acrescenta `audit_logs.record_id`. Não remove nem recria tabelas antigas.
2. `20260921180000_fix_login_rate_limit_conflict.sql`: corrige a ambiguidade SQL do limitador de login sem alterar usuários ou senhas.

Edge Functions:

- `login-username` versão 4: username → e-mail interno somente no servidor, senha validada pelo Supabase Auth, limite por origem+usuário e por usuário, respostas genéricas.
- `account-admin` versão 3: criação e redefinição de acesso somente por administrador da mesma empresa; rollback do usuário Auth se a associação inicial falhar.

## Matriz de validação em 21/09/2026

| Validação | Resultado | Evidência |
|---|---:|---|
| TypeScript estrito | passou | `npx tsc --noEmit` |
| Build Next.js de produção | passou | 11 rotas geradas; sem `ignoreBuildErrors` |
| Fórmulas e validações | 13/13 passaram | custo útil, margem x markup, taxas, promoção, ponto de equilíbrio, unidades, sub-receitas, ciclos, CMV e preservação de vendas |
| Responsividade | 8/8 passaram | 320, 375, 390, 414, 768 e 1280 px; sem overflow; alvo móvel de 44 px |
| Rede lenta/erro | passou | “Salvando...”, erro específico e conteúdo do formulário preservado |
| Acesso sem autenticação | passou | permanece no login |
| Login real da empresa | passou | dashboard “Doce Margem” carregado após correção do rate limit |
| Credencial inválida | passou | HTTP 401 genérico; não revela existência do usuário |
| Persistência entre dispositivos | passou | ingrediente temporário salvo na primeira sessão e lido numa segunda sessão isolada; removido ao final |
| Isolamento RLS | passou | anônimo sem leitura; membro lê a própria empresa e não a empresa de teste |
| Funções RLS | passou | viewer sem gravação; employee com gravação e sem exclusão; admin com exclusão |
| Estado após testes | passou | transações RLS revertidas; função do usuário permaneceu `admin`; `audit_records` voltou a 0 registros |

## Arquivos alterados

- Interface e estilos: `app/page.tsx`, `app/globals.css`.
- Rotas: `app/api/records/route.ts`, `app/api/me/route.ts` (mantida), `app/api/auth/login`, `logout`, `refresh`, `password`, `accounts`, `config` e `adopt-session`.
- Domínio: `lib/pricing.ts`, `lib/recipe-costs.ts`, `lib/records.ts`, `lib/auth.ts`, `lib/supabase-server.ts`, `lib/supabase-browser.ts`, `lib/crypto-auth.ts`.
- Infraestrutura: `next.config.ts`, `.env.example`, `.gitignore`, `package.json`, migrations e Edge Functions acima.
- Testes: `tests/pricing.spec.ts`, `tests/mobile.spec.ts`, `tests/live-account.spec.ts`.

## Pendências conhecidas (não bloqueiam o núcleo seguro)

- `npm run lint` ainda falha no acervo anterior de componentes `components/ui`, em regras novas do React/Oxlint e em conversões de `FormData` da página monolítica. `npx tsc --noEmit` e o build de produção passam; a limpeza do lint deve ser um trabalho incremental separado para não reescrever dezenas de componentes que não participam desta mudança.
- A agenda dedicada de fornecedores e uma tela para salvar/comparar cenários ainda não têm navegação própria; os tipos já são aceitos na persistência para uma próxima evolução incremental.
- Acessórios de produto continuam representados pelo custo agregado de adicionais e pela embalagem principal. Modelar tampa, colher, etiqueta e sacola como múltiplos vínculos merece migration/UI própria para não reinterpretar dados antigos.
- A recuperação esquecida é feita por administrador; envio automático por e-mail não foi ativado porque o login público não expõe e-mail interno.
- A publicação na Vercel deve ocorrer somente depois do commit/push e da configuração das duas variáveis públicas do servidor. Não inclua `SUPABASE_SERVICE_ROLE_KEY` na Vercel.

## Checklist de publicação

1. Executar e guardar o backup descrito acima.
2. Confirmar que as duas migrations constam no histórico do Supabase e que as versões das Edge Functions estão ativas.
3. No projeto Vercel ligado a `malakasdev7/Mousse`, configurar `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` para Production, Preview e Development.
4. Rodar `npm test`, `npm run test:mobile`, `npx tsc --noEmit` e `npm run build`.
5. Fazer commit/push, publicar pela Vercel e repetir login + leitura em dois navegadores no domínio definitivo.
6. Em cada navegador com cache antigo, exportar “dados antigos deste navegador” e importar conscientemente na empresa correta. A importação não apaga registros atuais.

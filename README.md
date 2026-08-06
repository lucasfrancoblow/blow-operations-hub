# BLOW Operations Hub

Crie uma aplicação web responsiva chamada “Hub de operacoes BLOW”.

Objetivo:

Ser o painel central de automações da BLOW, permitindo acompanhar workflows do n8n e Make, documentações, integrações, credenciais de referência e incidentes gerados automaticamente.

Importante:

- Nesta primeira etapa, crie uma interface completa e funcional com dados mockados.

- Não implemente autenticação real, banco real, webhooks ou chaves de API.

- Estruture o código e as telas para facilitar integração futura com Notion, n8n e Supabase.

- Nunca exibir ou armazenar valores de senhas, tokens, API keys ou client secrets. A área de credenciais deve guardar somente metadados operacionais.

Estilo visual:

- Interface SaaS moderna, premium e limpa.

- Tema escuro como padrão.

- Fundo escuro elegante, cards com bordas sutis, boa hierarquia visual e excelente legibilidade.

- Use detalhes em laranja para ações e alertas da marca BLOW; verde para saudável/sucesso, amarelo para atenção e vermelho para incidentes críticos.

- Tipografia moderna e objetiva.

- Layout desktop-first, mas totalmente responsivo.

- Não usar visual genérico ou excessivamente colorido. Priorizar clareza operacional.

Estrutura de navegação lateral:

1. Visão geral

2. Automações

3. Incidentes

4. Sistemas e integrações

5. Credenciais

6. Documentação

7. Configurações

Tela 1 — Visão geral:

Criar dashboard executivo com:

- Título: “hubLOw”

- Subtítulo: “Visão operacional das automações e integrações”

- Filtro de período e botão “Nova automação”

- Cards de métricas:

  - Automações ativas

  - Incidentes abertos

  - Incidentes críticos

  - Automações saudáveis

- Gráfico de incidentes por dia nos últimos 30 dias

- Gráfico por categoria de erro

- Lista “Incidentes recentes”

- Lista “Automações que exigem atenção”

- Lista “Credenciais próximas de revisão”

- Status geral por sistema: n8n, Make, PipeRun, Google Ads, Slack, Notion e Google Sheets.

Tela 2 — Automações:

Criar uma tabela e modo cards.

Filtros:

- Busca por nome

- Plataforma: n8n / Make

- Status: Ativa / Pausada / Em manutenção / Descontinuada

- Área: Marketing / Comercial / Implantação / People / Operações

- Saúde: Saudável / Atenção / Crítica

Colunas:

- Nome

- Plataforma

- Área

- Status

- Saúde

- Último erro

- Incidentes abertos

- Responsável

- Última revisão

Dados de exemplo:

- Retorno Leads Google Ads — Conversões Offline

- Leads Portal — Backup de Leads

- Central de Erros

- Aviso de novos leads no Slack

- Sincronização de contatos PipeRun

- Relatório semanal de marketing

Tela 3 — Detalhe da Automação:

Ao clicar em uma automação, abrir uma página detalhada com:

Cabeçalho:

- Nome da automação

- Status

- Indicador de saúde

- Plataforma

- Área responsável

- Responsável técnico

- Botões: “Abrir no n8n”, “Editar”, “Ver documentação”

Abas:

1. Visão geral

2. Fluxo

3. Incidentes

4. Integrações

5. Credenciais

6. Documentação

7. Histórico

Na aba “Visão geral”:

- Objetivo da automação

- Descrição do que ela faz

- Gatilho

- Frequência

- Última execução

- Próxima execução, quando aplicável

- Métricas de saúde

- Lista de sistemas envolvidos

Na aba “Fluxo”:

- Renderizar um fluxograma visual simples dos nós.

- Exemplo:

  Schedule Trigger → Gerar Token → Buscar Leads → Transformar Dados → Salvar no Google Sheets

- Cada nó deve apresentar nome, tipo, status e descrição curta.

- Não precisa integrar ao n8n ainda; usar dados mockados.

Na aba “Incidentes”:

- Tabela dos incidentes relacionados à automação.

- Campos:

  Severidade, Status, Resumo, Nó com falha, Código HTTP, Ocorrências, Última ocorrência e Responsável.

- Ao clicar em um incidente, abrir painel lateral com diagnóstico, causa provável, evidências, solução sugerida, links para execução no n8n e página do Notion.

Tela 4 — Incidentes:

Criar central de incidentes com:

- Cards: Abertos, Investigando, Resolvidos, Críticos

- Tabela com filtros por severidade, status, categoria, automação e período.

- Badges:

  - Crítica: vermelho

  - Alta: laranja

  - Média: amarelo

  - Baixa: azul/cinza

- Status:

  - Aberto

  - Investigando

  - Resolvido

Detalhe do incidente:

- Título

- Status e severidade

- Automação afetada

- Nó que falhou

- Código HTTP

- Quantidade de ocorrências

- Primeira e última ocorrência

- Resumo gerado por IA

- Fatos observados

- Causa provável

- Solução sugerida

- Evidências técnicas

- Link “Abrir execução no n8n”

- Link “Abrir no Notion”

- Linha do tempo de ocorrências

Tela 5 — Sistemas e Integrações:

Cards para:

- n8n

- Make

- PipeRun

- Google Ads

- Google Sheets

- Notion

- Slack

- Portal do Franchising

Cada card deve exibir:

- Status

- Quantidade de automações dependentes

- Incidentes abertos relacionados

- Última verificação

- Botão “Ver detalhes”

Tela 6 — Credenciais:

Criar tabela segura de referência, sem mostrar segredos.

Campos:

- Nome da credencial

- Sistema

- Tipo: OAuth2, API Key, Basic Auth, Webhook

- Local de configuração

- Responsável

- Status

- Última revisão

- Próxima revisão

- Automações relacionadas

Exemplos:

- Google Ads account

- Slack-canal

- Sheets Credenciais - Blow

- Notion account

- Portal do Franchising API

Tela 7 — Documentação:

Criar uma área de base de conhecimento com:

- Busca

- Filtros por área, plataforma e sistema

- Cards de documentação

- Exemplo de documento:

  “WF-001 | Leads Portal — Portal do Franchising”

- Campos: objetivo, fluxo, dependências, credenciais de referência, testes Postman, plano de contingência e responsável.

Componentes obrigatórios:

- Sidebar recolhível

- Header com busca global, notificações e perfil

- Breadcrumbs

- Tabelas com paginação

- Filtros visuais

- Badges de status

- Modais ou drawers para detalhes

- Estados vazios bem desenhados

- Skeleton loading

- Toasts de sucesso/erro simulados

- Tooltips para termos técnicos

- Layout responsivo para tablet e mobile

Dados e arquitetura:

- Criar tipos/interfaces para Automation, Incident, Integration, Credential e Documentation.

- Usar dados mockados em arquivo separado.

- Criar serviços abstratos/fake para que depois seja fácil trocar por Supabase, Notion API e n8n API.

- Adicionar comentários curtos indicando pontos futuros de integração.

- Entregar uma experiência navegável entre todas as telas.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/29340b03-a5fe-4bfa-aebe-c7f2e0e888bb).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

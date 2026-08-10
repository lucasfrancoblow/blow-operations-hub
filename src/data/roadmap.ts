// Roadmap de inovação — propostas de automação para a operação BLOW.
// Curadoria manual (não vem de nenhuma API): é o backlog de ideias do time de
// automação, não dado operacional. Status reflete a realidade — nada aqui foi
// marcado como "em construção" até entrar de fato em desenvolvimento.

export type RoadmapArea = "Marketing" | "Comercial" | "Implantação" | "People" | "Operações";

export type RoadmapLevel = "Baixo" | "Médio" | "Alto";

export type RoadmapStatus = "Ideia" | "Em avaliação" | "Planejado" | "Em construção";

export interface RoadmapItem {
  id: string;
  title: string;
  area: RoadmapArea;
  impact: RoadmapLevel;
  effort: RoadmapLevel;
  status: RoadmapStatus;
  pitch: string;
  description: string;
  buildsOn?: string;
}

export const roadmapItems: RoadmapItem[] = [
  {
    id: "referral-engine",
    title: "Motor de indicação contínuo",
    area: "Marketing",
    impact: "Alto",
    effort: "Médio",
    status: "Ideia",
    pitch: "Transforma a campanha sazonal de indicação num programa permanente.",
    description:
      "A campanha de indicação do Dia dos Namorados já resolveu cupom, validação e aviso no Slack por unidade. Generalizar o mesmo motor para rodar o ano inteiro (sem depender de data comemorativa) aproveita a maior parte do que já foi construído e vira uma fonte de leads recorrente.",
    buildsOn: "Campanha de indicação — Dia dos Namorados",
  },
  {
    id: "cold-lead-reactivation",
    title: "Reativação de lead frio",
    area: "Marketing",
    impact: "Alto",
    effort: "Baixo",
    status: "Ideia",
    pitch: "Lead que esfriou entra num fluxo automático em vez de morrer na planilha.",
    description:
      "Leads sem agendamento depois de X dias caem automaticamente num fluxo de reengajamento (WhatsApp ou e-mail), sem depender de alguém lembrar de revisitar a base manualmente.",
  },
  {
    id: "cac-alert",
    title: "Alerta de CAC por unidade",
    area: "Marketing",
    impact: "Médio",
    effort: "Baixo",
    status: "Ideia",
    pitch: "Custo de aquisição fora do padrão avisa antes de virar rombo no fim do mês.",
    description:
      "Cruza os dados de campanha (Google Ads) por unidade franqueada e dispara um alerta quando o custo por lead de uma unidade específica sai do intervalo normal — hoje isso só é percebido no relatório semanal manual.",
    buildsOn: "Relatório semanal de marketing",
  },
  {
    id: "sla-escalation",
    title: "Escalonamento automático de SLA",
    area: "Comercial",
    impact: "Alto",
    effort: "Baixo",
    status: "Em avaliação",
    pitch: "SLA furado avisa o gestor na hora, não só fica registrado numa tabela.",
    description:
      "O fluxo de SLA já registra quando um lead não é respondido no prazo. Falta fechar o loop: quando o SLA é furado, notificar automaticamente o gestor da unidade responsável em vez de só guardar o dado.",
    buildsOn: "sla-fluxo · criacao-tabela-sla",
  },
  {
    id: "duplicate-lead-detection",
    title: "Detecção de lead duplicado entre unidades",
    area: "Comercial",
    impact: "Médio",
    effort: "Médio",
    status: "Ideia",
    pitch: "Evita a briga clássica de franquia por atribuição de comissão.",
    description:
      "Mesmo cliente aparecendo em duas unidades próximas gera conflito de atribuição comercial. Uma automação de detecção (por telefone/e-mail) alerta antes de virar disputa interna.",
  },
  {
    id: "store-opening-pipeline",
    title: "Pipeline de abertura de unidade ponta a ponta",
    area: "Implantação",
    impact: "Alto",
    effort: "Alto",
    status: "Ideia",
    pitch: "Um evento dispara tudo que hoje é um checklist manual de abertura.",
    description:
      'O registro de inauguração já existe numa planilha. A ideia é que 1 gatilho ("unidade assinou contrato") crie automaticamente o canal do Slack, a linha na planilha mestre, a pasta de documentação e o cadastro no Portal do Franchising — hoje feito item por item.',
    buildsOn: "gtm-inauguracao-planilha",
  },
  {
    id: "franchisee-onboarding",
    title: "Onboarding de franqueado com checklist automático",
    area: "Implantação",
    impact: "Médio",
    effort: "Médio",
    status: "Ideia",
    pitch: "Visibilidade de quanto falta antes da inauguração, sem planilha de controle manual.",
    description:
      "Sequência automática de tarefas e lembretes para o franqueado, com % de conclusão calculado automaticamente antes da data de inauguração.",
  },
  {
    id: "access-provisioning",
    title: "Provisionamento e desprovisionamento de acesso",
    area: "People",
    impact: "Alto",
    effort: "Baixo",
    status: "Ideia",
    pitch:
      "Menos risco de segurança do que ganho de eficiência — acesso esquecido ativo é o problema real.",
    description:
      "Libera acessos (Slack, PipeRun, e-mail) automaticamente na admissão e revoga no desligamento, no dia certo — hoje depende de alguém lembrar manualmente.",
  },
  {
    id: "climate-pulse",
    title: "Pulse de clima organizacional por unidade",
    area: "People",
    impact: "Baixo",
    effort: "Baixo",
    status: "Ideia",
    pitch: "Pesquisa curta recorrente com resultado agregado sem trabalho manual de consolidação.",
    description:
      "Disparo periódico de uma pesquisa curta por unidade, com agregação automática do resultado por região — hoje inexistente ou manual.",
  },
  {
    id: "ai-incident-triage",
    title: "Triagem de incidente com IA de verdade",
    area: "Operações",
    impact: "Alto",
    effort: "Médio",
    status: "Em avaliação",
    pitch: "A tela já existe — falta plugar um raciocínio real em vez de texto genérico.",
    description:
      'O hub já mostra "causa provável" e "resumo" para cada incidente real do n8n, mas hoje o texto é genérico. Plugar um LLM analisando o erro + histórico do nó específico entrega diagnóstico de fato, reduzindo o tempo de triagem — sem precisar mudar nada de tela, só a fonte do dado.',
    buildsOn: "Central de Erros (Incidentes)",
  },
  {
    id: "credential-expiry-alert",
    title: "Alerta preditivo de credencial expirando",
    area: "Operações",
    impact: "Médio",
    effort: "Baixo",
    status: "Ideia",
    pitch: "Descobrir antes de quebrar em produção, não pelo incidente.",
    description:
      "Testa periodicamente se um token/credencial ainda é válido e avisa com antecedência — hoje só se descobre quando a automação já falhou.",
    buildsOn: "Credenciais",
  },
  {
    id: "auto-recovery-runbook",
    title: "Runbook automático de recuperação",
    area: "Operações",
    impact: "Médio",
    effort: "Alto",
    status: "Ideia",
    pitch: "Erros conhecidos se resolvem sozinhos antes de virar incidente para humano.",
    description:
      "Para falhas recorrentes já conhecidas (ex: 401 num token específico), a automação tenta reautenticar/retry sozinha antes de abrir um incidente para um humano olhar.",
  },
];

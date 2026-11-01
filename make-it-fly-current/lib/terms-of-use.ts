import {legalApprovals} from "./legal-documents.mjs";
import {privacyPolicyReady} from "./privacy-policy";

export const termsOfUseReady=()=>privacyPolicyReady()&&legalApprovals().terms;
export const termsSections=[
  {id:'servico',title:'O serviço Apogee',paragraphs:[
    'A Apogee oferece conteúdo, comunidade, experiências e um catálogo de oportunidades com calendários e recursos de acompanhamento. Cada recurso pode ter condições de acesso próprias, apresentadas na oferta ou na página correspondente.',
    'O Radar reúne informações de fontes consultadas pela equipe e pelos coletores. Datas, requisitos e decisões pertencem às instituições responsáveis e podem mudar. Confira o edital e os canais oficiais antes de se inscrever ou assumir despesas. A Apogee não realiza a inscrição externa nem garante aprovação, vaga, bolsa ou resultado.',
  ]},
  {id:'conta',title:'Conta e participação de menores',paragraphs:[
    'A conta de acesso deve pertencer a um adulto, com informações corretas e credenciais mantidas em sigilo. A liberação da comunidade e dos recursos protegidos depende da confirmação do e-mail, da revisão da conta e das permissões aplicáveis. Login Google ou pagamento, isoladamente, não substituem a revisão.',
    'Durante a transição, contas existentes abrangidas pelo plano de revisão mantêm o acesso anterior enquanto aguardam conferência. Essa preservação não aprova maioridade nem novos vínculos de dependentes. Para conectar e sincronizar o Google Agenda, a conta precisa de e-mail confirmado e conferência, inclusive durante a transição; administradores identificados pela equipe utilizam suas permissões administrativas.',
    'Crianças e adolescentes, inclusive menores de 16 anos, podem ser vinculados de forma privada à conta de pai, mãe ou responsável legal. O vínculo depende de autorização e conferência específicas; o menor não recebe senha, login próprio, perfil público ou acesso ao fórum. O responsável pode revogar a autorização pelo portal e solicitar atendimento pelo canal de privacidade.',
    'Não compartilhe sua senha com o menor. Experiências específicas, como o Make It Fly, têm critérios independentes de idade e participação. O vínculo não inscreve o dependente em uma instituição externa nem concede acesso pago.',
  ]},
  {id:'acesso',title:'Ofertas e direitos de acesso',paragraphs:[
    'Conteúdo público, área de membros e funcionalidades pagas podem ter níveis de acesso distintos. Preço, forma de pagamento, duração e recursos incluídos devem estar claros na oferta antes da contratação. Estas condições não ampliam nem reduzem o acesso que você já adquiriu.',
    'Ofertas identificadas como vitalícias respeitam as condições apresentadas na contratação. Estes termos não criam assinatura recorrente nem alteram a duração ou os recursos de compras existentes. Em caso de dúvida sobre a sua oferta, solicite as condições pelo canal de atendimento.',
  ]},
  {id:'google',title:'Conexão opcional com o Google Agenda',paragraphs:[
    'Conectar o Google Agenda é uma autorização adicional ao login Google e depende das permissões da conta Apogee. O aplicativo solicita calendar.app.created para criar uma agenda secundária e gerenciar os eventos das oportunidades salvas. Não solicita leitura da agenda principal, e-mails ou contatos; a integração atual não envia convites.',
    'A sincronização utiliza os dados disponíveis no Radar e pode aguardar atualização da fonte, processamento da fila, disponibilidade e limites do Google. Há retentativas para falhas temporárias e situações que exigem reconexão. O recurso não promete atualização instantânea ou um prazo fixo para toda alteração de uma fonte externa.',
    'Você pode desconectar o Google Agenda no portal e revogar a autorização nas configurações da Conta Google. A desconexão interrompe novas atualizações, mas os eventos e a agenda já criados permanecem no Google e podem ser removidos por você. O uso e a conservação dos dados estão descritos na Política de Privacidade.',
  ]},
  {id:'conduta',title:'Uso da comunidade',paragraphs:[
    'Use os espaços da comunidade com respeito às outras pessoas. Não publique dados pessoais de terceiros sem fundamento adequado, conteúdo ilícito, ameaças, discriminação, golpes ou material que viole direitos. Não tente contornar restrições de acesso ou comprometer a segurança do serviço.',
    'A equipe pode analisar denúncias e adotar medidas proporcionais de moderação e segurança, informando o motivo e o canal de contestação quando isso for possível sem prejudicar a proteção das pessoas ou uma apuração. Direitos relacionados a compras e pedidos sobre dados pessoais são tratados separadamente, conforme a legislação aplicável.',
  ]},
  {id:'atendimento',title:'Atendimento, cancelamento e direitos do consumidor',paragraphs:[
    'Pedidos de suporte, cancelamento e revisão podem ser enviados a contato@apogee.community. Use o e-mail da conta e descreva o pedido sem enviar senha, códigos, dados completos de cartão ou documentos de menores. A equipe poderá confirmar sua identidade de forma proporcional.',
    'Os direitos previstos no Código de Defesa do Consumidor permanecem assegurados. Nas contratações a distância, aplica-se o direito de arrependimento quando presentes seus requisitos legais, sem renúncia antecipada por aceitar estes termos. Questões de cobrança, restituição e eventual descumprimento da oferta devem ser analisadas conforme a contratação e a lei.',
    'Desconectar o Google não cancela automaticamente uma compra. Excluir uma conta e revogar a autorização de um dependente também são pedidos distintos. A equipe deve explicar as consequências de cada medida e respeitar os direitos e as retenções legalmente aplicáveis.',
  ]},
  {id:'alteracoes',title:'Alterações e solução de dúvidas',paragraphs:[
    'Alterações relevantes nas condições de uso devem ser comunicadas de modo adequado. Não serão interpretadas como autorização para reduzir retroativamente direitos de compras existentes ou afastar obrigações legais. Uma finalidade de tratamento que exija nova autorização deve ter escolha específica.',
    'Estes termos devem ser interpretados conforme a legislação brasileira, preservando os direitos do consumidor e o acesso aos canais de atendimento, órgãos competentes e Justiça. A versão e a data ficam disponíveis nesta página.',
  ]},
];

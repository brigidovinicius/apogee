import {legalApprovals} from "./legal-documents.mjs";
// Controller identity, contact and inclusion of minors confirmed on 2026-10-30.
export const privacyIdentity: {name:string;document:string;location:string|null;email:string|null;audienceConfirmed:boolean} = {
  name:"62.858.706 ROSA MARIA PEREIRA MIRANDA - ME",
  document:"62.858.706/0001-46",
  location:"Florianópolis/SC, Brasil",
  email:"contato@apogee.community",
  audienceConfirmed:true,
};
export function privacyPolicyReady() {
  return !!privacyIdentity.email && privacyIdentity.audienceConfirmed && process.env.MEMBERS_SUPERVISED_REGISTRATION_ENABLED==='true' && legalApprovals().privacy;
}

export const privacySections = [
  {id:"alcance",title:"Sobre esta política",paragraphs:[
    "Esta política explica o tratamento de dados pessoais no site Apogee, na comunidade de membros, no Radar de Oportunidades e nas inscrições para experiências como o Make It Fly. Cada atividade utiliza apenas os dados necessários à sua finalidade. A simples consulta a esta página não representa consentimento para novas finalidades.",
  ]},
  {id:"dados",title:"Quais dados são tratados",paragraphs:[
    "Conta e comunidade: nome, e-mail, nome de usuário, foto e biografia fornecidos, credenciais de acesso, situação da conta e conteúdo que você publica. Senhas de cadastro são armazenadas como hashes; o Apogee não recebe sua senha do Google. Sessões podem conter endereço IP, informações do navegador e datas de acesso para autenticação e segurança.",
    "Inscrições em experiências: nome, e-mail, telefone, idade, profissão, respostas sobre sua ideia e os recursos disponíveis para participar, além da origem da inscrição. Os critérios e as condições de cada experiência são apresentados no respectivo formulário.",
    "Radar: oportunidades salvas, combinações de filtros com os nomes escolhidos por você, escolhas de acesso, dados da conexão opcional com o Google Agenda e registros de sincronização. Quando houver pagamento, também são tratados identificadores da compra, valores, situação do pagamento e do direito de acesso. O pagamento é processado pela Stripe; os campos completos de cartão são preenchidos no ambiente do provedor.",
    "Navegação: registros técnicos necessários à operação e à prevenção de abuso. No Make It Fly, também podem ser registrados eventos de páginas e seções visitadas, botões acionados, etapas do formulário, tipo de dispositivo e erros de envio. Os eventos de navegação não copiam o conteúdo das respostas do formulário, mas podem ser associados à inscrição por um identificador de sessão.",
  ]},
  {id:"finalidades",title:"Finalidades e bases legais",paragraphs:[
    "Conta, autenticação, oportunidades salvas, prestação dos serviços e atendimento de pedidos: execução do contrato ou de procedimentos solicitados por você, quando essa hipótese for aplicável. A inscrição em uma experiência também pode ser utilizada para analisar os critérios informados e organizar sua participação.",
    "Prevenção de fraude, controle de acesso, estabilidade e diagnóstico: legítimo interesse, sujeito à avaliação de necessidade, proporcionalidade e impacto sobre seus direitos. Registros exigidos por lei e informações necessárias à defesa de direitos podem ser mantidos com fundamento em obrigação legal ou exercício regular de direitos.",
    "Conexão opcional com o Google Agenda e outras atividades que dependam de consentimento: autorização específica, informada e revogável. Comunicações promocionais que dependam de consentimento devem oferecer uma escolha separada e uma forma de cancelamento. O uso do serviço não implica autorização genérica de marketing.",
  ]},
  {id:"avisos-radar",title:"Avisos de oportunidades e próximas edições",paragraphs:[
    "Ao solicitar avisos, registramos seu e-mail, a oportunidade ou competição escolhida, a data da solicitação e da confirmação, o estado da assinatura e os registros necessários à fila de envio e prevenção de duplicatas. O acompanhamento de uma edição e o acompanhamento de próximas edições são escolhas separadas, com confirmação por e-mail. Uma assinatura existente não passa a incluir próximas edições automaticamente.",
    "O acompanhamento de uma edição termina após o encerramento, início do evento, cancelamento ou publicação de resultado, conforme a situação confirmada. O acompanhamento de próximas edições permanece ativo entre edições até você cancelar. Cada e-mail inclui um link de cancelamento. A rotina programa a exclusão de assinaturas canceladas ou concluídas após 30 dias; solicitações não confirmadas são removidas quando a confirmação está vencida há sete dias.",
    "Filtros nomeados ficam na sua conta até você removê-los ou encerrar a conta. Salvar um filtro não cria uma assinatura de e-mail, não inscreve você em um evento e não adiciona automaticamente os resultados ao Google Agenda.",
  ]},
  {id:"google-agenda",title:"Google: login e sincronização do calendário",paragraphs:[
    "Ao escolher o login Google, usamos os dados de identificação autorizados, como nome, e-mail verificado, identificador da conta e foto, para autenticar e relacionar sua conta Apogee. Conectar o Google Agenda é uma escolha adicional: o login, por si só, não autoriza o acesso ao calendário.",
    "Para sincronizar, solicitamos a permissão calendar.app.created, que permite criar agendas secundárias e gerenciar eventos nas agendas criadas pelo aplicativo. O Apogee não solicita leitura da sua agenda principal, de e-mails ou de contatos. Enviamos ao Google os títulos, datas e horários das etapas das oportunidades salvas e o link de acesso no Radar. A integração atual não adiciona convidados nem envia convites.",
    "Armazenamos uma credencial de renovação criptografada, o identificador da agenda criada, identificadores dos eventos e informações de situação e última sincronização. Esses dados permitem atualizar as datas sem exigir novo login a cada execução. São utilizados para oferecer e manter a funcionalidade de calendário, sem venda, publicidade direcionada ou treinamento de modelos de inteligência artificial com dados obtidos das APIs Google.",
    "Você pode parar a sincronização em Meu calendário, usando Desconectar Google Agenda. Isso interrompe o uso da credencial de renovação pela integração; a agenda e os eventos já criados permanecem na sua conta Google, onde você pode apagá-los. Para revogar a autorização do aplicativo no provedor, use também as configurações de conexões da sua Conta Google. Uma reconexão pode ser necessária para voltar a sincronizar.",
    "O tratamento de dados das APIs Google deve observar a Google API Services User Data Policy. Quando forem aplicáveis os requisitos de uso limitado do Google, os dados ficam restritos à prestação e à melhoria da funcionalidade autorizada, às hipóteses de segurança e às obrigações legais permitidas pela política do provedor.",
  ]},
  {id:"compartilhamento",title:"Compartilhamento e visibilidade",paragraphs:[
    "Dados podem ser tratados por prestadores necessários à hospedagem e ao banco de dados, autenticação, envio de e-mails e pagamentos. A estrutura do serviço utiliza hospedagem em VPS, banco PostgreSQL, Supabase para inscrições e eventos do Make It Fly, Google para autenticação e calendário, Stripe para pagamentos e Resend para e-mails quando esses recursos estão habilitados. Integrações administrativas configuradas podem enviar inscrições e eventos de navegação para planilhas Google.",
    "Perfis e mensagens publicados por você na comunidade podem ser vistos conforme as regras de acesso desses espaços. Conteúdo publicado em áreas públicas, como blog e galeria, pode ser consultado e indexado por terceiros. Evite incluir informações sensíveis ou dados de outras pessoas sem autorização. Respostas privadas de inscrição e credenciais de calendário não são publicadas no catálogo.",
    "Também pode haver compartilhamento quando necessário ao cumprimento de lei, ordem válida de autoridade ou defesa de direitos. Cada prestador deve receber os dados compatíveis com a finalidade do serviço que executa, com acesso restrito às pessoas e sistemas autorizados.",
  ]},
  {id:"transferencias",title:"Tratamento em outros países",paragraphs:[
    "Provedores internacionais, como Google, Supabase, Stripe e Resend, podem processar dados fora do Brasil, conforme seus serviços e configurações. A transferência internacional exige uma hipótese admitida pela LGPD e as garantias aplicáveis, inclusive os instrumentos previstos na regulamentação da ANPD. Você pode solicitar informações sobre os prestadores, finalidades e mecanismos utilizados pelo canal de privacidade.",
  ]},
  {id:"cookies",title:"Cookies e armazenamento no navegador",paragraphs:[
    "Usamos cookies de sessão e mecanismos de segurança para manter a autenticação, proteger operações e permitir a navegação nas áreas restritas. Esses recursos são necessários ao funcionamento solicitado e podem deixar de funcionar se você bloquear todos os cookies.",
    "O Make It Fly usa armazenamento de sessão no navegador para um identificador de navegação e pode registrar eventos de uso. O coletor respeita o sinal Do Not Track do navegador. Isso não representa anonimização garantida: o identificador pode ser relacionado à inscrição enviada na mesma jornada. Preferências e escolhas adicionais de privacidade, quando implementadas, devem ser informadas antes da ativação de novos rastreadores ou finalidades.",
  ]},
  {id:"retencao",title:"Conservação e eliminação",paragraphs:[
    "Dados de conta e informações necessárias ao serviço são mantidos durante a relação com o usuário e pelo tempo necessário à finalidade correspondente. Após o encerramento, alguns registros podem precisar ser conservados para cumprir obrigações legais, prevenir fraude ou exercer direitos. A conservação deve ficar limitada à finalidade e ao prazo aplicáveis; não significa autorização para reutilização irrestrita.",
    "Você pode pedir a exclusão da conta, das respostas de inscrição ou de outros dados pelo canal de privacidade. Quando houver fundamento para conservar parte das informações, explicaremos as categorias e o motivo. Cópias de segurança podem ter um ciclo de retenção diferente do banco em uso. A remoção no Apogee não apaga automaticamente os eventos que já foram enviados à sua conta Google.",
  ]},
  {id:"direitos",title:"Seus direitos e como exercê-los",paragraphs:[
    "Nos termos da LGPD, você pode solicitar confirmação do tratamento e acesso aos seus dados; correção de informações; anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados irregularmente; portabilidade nas condições regulamentares; informações sobre compartilhamento; revogação de consentimento e esclarecimentos sobre a possibilidade de não consentir e suas consequências.",
    "Também pode solicitar a eliminação de dados tratados com consentimento, ressalvadas as hipóteses legais de conservação, e a revisão de decisões tomadas unicamente por tratamento automatizado que afetem seus interesses. No Make It Fly, as respostas podem ser comparadas automaticamente com critérios da experiência; você pode pedir esclarecimentos sobre esses critérios e revisão do resultado.",
    "Para atender seu pedido com segurança, poderemos confirmar sua identidade de maneira proporcional, sem solicitar documentos além do necessário. O atendimento é gratuito. A confirmação ou o acesso podem ser apresentados de forma simplificada imediatamente ou, quando cabível, por declaração completa em até quinze dias. Outros pedidos seguem os prazos e condições legais aplicáveis. Se não for possível atender integralmente, informaremos o motivo e os próximos passos. Você também pode apresentar petição à ANPD.",
  ]},
  {id:"menores",title:"Crianças e adolescentes",paragraphs:[
    "O tratamento de dados de crianças e adolescentes exige avaliação específica do seu melhor interesse e das obrigações da LGPD, do ECA e do ECA Digital. As informações devem ser claras e adequadas à idade. Autorização ou vínculo com responsável, aferição de faixa etária e controles de proteção devem ser adotados quando exigidos para a atividade e as funcionalidades oferecidas.",
    "A Apogee admite o acompanhamento de oportunidades para crianças e adolescentes, inclusive menores de 16 anos, por meio de cadastro privado vinculado ao pai, à mãe ou ao responsável legal. A conta de acesso pertence a um adulto. O menor não recebe login próprio, perfil público ou acesso ao fórum. As oportunidades salvas e a conexão Google Agenda são gerenciadas na conta do responsável, conforme suas permissões de acesso.",
    "A conta adulta depende de e-mail confirmado e revisão administrativa de maioridade. Para o vínculo do menor, são registrados apenas apelido, faixa etária, tipo de vínculo, autorização e situação da revisão. Não solicitamos no formulário do dependente nome completo, CPF, documentos, escola ou data de nascimento. A equipe também deve conferir a responsabilidade legal e a faixa etária por procedimento apropriado antes de aprovar o vínculo. Uma autodeclaração ou um e-mail confirmado, isoladamente, não comprovam idade ou responsabilidade.",
    "O responsável pode acompanhar a situação e revogar a autorização em Cadastro protegido, interrompendo a habilitação do vínculo. A revogação não elimina automaticamente os registros necessários à comprovação do atendimento ou de obrigações legais; a eliminação pode ser solicitada pelo canal de privacidade. As revisões e as autorizações ficam registradas para controle de acesso e prestação de contas. O cadastro de um dependente não autoriza marketing nem concede um acesso pago.",
    "As condições de participação em experiências específicas, como o Make It Fly, são independentes e podem exigir idade mínima própria. O acesso ao catálogo público não cria uma conta nem inscreve o menor em oportunidades externas. Pais e responsáveis devem acompanhar os requisitos e a política de cada instituição ao acessar os links de inscrição.",
  ]},
  {id:"seguranca",title:"Segurança e incidentes",paragraphs:[
    "Adotamos controles de acesso, comunicação protegida em produção, armazenamento de senhas como hashes e criptografia das credenciais de renovação do Google Agenda. O acesso administrativo depende das permissões da conta. Essas medidas reduzem riscos, mas nenhum sistema elimina todas as possibilidades de falha. Não compartilhe senhas ou autorizações da sua conta.",
    "Incidentes com dados pessoais devem ser avaliados e tratados conforme sua natureza e impacto, com comunicação à ANPD e às pessoas afetadas quando os requisitos legais forem atendidos, observados os prazos da regulamentação vigente.",
  ]},
  {id:"alteracoes",title:"Alterações desta política",paragraphs:[
    "Esta política pode ser atualizada para refletir mudanças no serviço, nas finalidades ou na legislação. Mudanças relevantes devem ser comunicadas de forma adequada. Quando uma nova finalidade exigir consentimento, a autorização deve ser solicitada antes do novo tratamento. A versão e a data de atualização ficam disponíveis nesta página.",
  ]},
];

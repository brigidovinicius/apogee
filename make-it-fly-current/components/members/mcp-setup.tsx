"use client";

import { useId, useState } from "react";
import { ArrowUpRight, Copy } from "lucide-react";
import styles from "./mcp-setup.module.css";

export function McpSetup({ resource }: { resource: string }) {
  const feedbackId = useId();
  const [feedback, setFeedback] = useState("");
  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(resource);
      setFeedback("Endereço copiado. Cole ao adicionar a conexão no ChatGPT ou no Claude.");
    } catch {
      setFeedback("Selecione e copie o endereço acima. Depois, cole ao adicionar a conexão no ChatGPT ou no Claude.");
    }
  }
  return <section className={styles.setup} aria-labelledby="mcp-setup-title">
    <p className={styles.eyebrow}>Apogee + ChatGPT + Claude</p>
    <h2 id="mcp-setup-title">Suas oportunidades, na conversa.</h2>
    <p>Explore o Radar, consulte seu perfil e organize seu calendário e suas coleções com sua conta Apogee.</p>
    <div className={styles.providers}><a className={styles.primary} href="https://chatgpt.com/plugins" target="_blank" rel="noopener noreferrer">
      Incluir no meu ChatGPT <ArrowUpRight size={18} aria-hidden="true" />
    </a>
    <a className={styles.primary} href="https://claude.ai/customize/connectors" target="_blank" rel="noopener noreferrer">
      Incluir no meu Claude <ArrowUpRight size={18} aria-hidden="true" />
    </a></div>
    <p className={styles.hint}>Abre o aplicativo escolhido em outra aba. Você concluirá a conexão por lá.</p>
    <div className={styles.address}>
      <label>Endereço da Apogee<input type="url" readOnly value={resource} onFocus={event => event.currentTarget.select()} /></label>
      <button type="button" onClick={copyAddress} aria-describedby={feedbackId}><Copy size={16} aria-hidden="true" />Copiar endereço</button>
    </div>
    <p className={styles.feedback} id={feedbackId} role="status" aria-atomic="true">{feedback}</p>
    <h3>No ChatGPT</h3><ol className={styles.steps}>
      <li>No ChatGPT, abra <strong>Plugins</strong>, toque em <strong>+</strong> e escolha <strong>Add custom MCP server</strong>.</li>
      <li>Use o nome <strong>Apogee</strong>, cole o endereço acima em <strong>Server URL</strong> e escolha <strong>OAuth</strong> na autenticação.</li>
      <li>Entre com sua conta Apogee e confira as permissões solicitadas. Crie o plugin e instale-o. Em uma conversa, use <strong>@Apogee</strong>.</li>
    </ol>
    <p className={styles.hint}>A opção de conexão depende do seu plano e das permissões do seu espaço no ChatGPT. <a href="https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt" target="_blank" rel="noopener noreferrer">Ver instruções da OpenAI</a>.</p>
    <h3 id="claude">No Claude</h3><ol className={styles.steps}>
      <li>Abra <strong>Personalizar → Conectores</strong> (Customize → Connectors) e adicione um <strong>conector personalizado da web</strong>.</li>
      <li>Use o nome <strong>Apogee</strong> e cole o endereço acima. Revise a autenticação OAuth detectada e escolha <strong>Entrar agora</strong> (Sign in now).</li>
      <li>Em <strong>OAuth client</strong>, escolha <strong>Register automatically</strong>. Adicione o conector, entre na sua conta Apogee e confira as permissões. Depois, ative a Apogee nos conectores da conversa.</li>
    </ol>
    <p className={styles.hint}>Em espaços de equipe, o administrador pode precisar adicionar o conector primeiro. <a href="https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp" target="_blank" rel="noopener noreferrer">Ver instruções do Claude</a>.</p>
    <details className={styles.more}><summary>Já conectou a versão anterior?</summary>
      <p>Conexões antigas continuam com as permissões que você já autorizou. Para organizar calendário e coleções, autorize as permissões adicionais quando solicitado. Se o aplicativo não permitir ampliar o acesso, remova a conexão antiga no aplicativo e crie uma nova.</p>
    </details>
  </section>;
}

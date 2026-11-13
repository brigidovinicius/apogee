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
      setFeedback("Endereço copiado. Cole no campo Server URL do ChatGPT.");
    } catch {
      setFeedback("Selecione e copie o endereço acima. Depois, cole no campo Server URL do ChatGPT.");
    }
  }
  return <section className={styles.setup} aria-labelledby="mcp-setup-title">
    <p className={styles.eyebrow}>Apogee + ChatGPT</p>
    <h2 id="mcp-setup-title">Suas oportunidades, na conversa.</h2>
    <p>Explore o Radar, consulte seu perfil e organize seu calendário e suas coleções com sua conta Apogee.</p>
    <a className={styles.primary} href="https://chatgpt.com/plugins" target="_blank" rel="noopener noreferrer">
      Incluir no meu ChatGPT <ArrowUpRight size={18} aria-hidden="true" />
    </a>
    <p className={styles.hint}>Abre o ChatGPT em outra aba. Você concluirá a conexão por lá.</p>
    <div className={styles.address}>
      <label>Endereço da Apogee<input type="url" readOnly value={resource} onFocus={event => event.currentTarget.select()} /></label>
      <button type="button" onClick={copyAddress} aria-describedby={feedbackId}><Copy size={16} aria-hidden="true" />Copiar endereço</button>
    </div>
    <p className={styles.feedback} id={feedbackId} role="status" aria-atomic="true">{feedback}</p>
    <ol className={styles.steps}>
      <li>No ChatGPT, abra <strong>Plugins</strong>, toque em <strong>+</strong> e escolha <strong>Add custom MCP server</strong>.</li>
      <li>Use o nome <strong>Apogee</strong>, cole o endereço acima em <strong>Server URL</strong> e escolha <strong>OAuth</strong> na autenticação.</li>
      <li>Entre com sua conta Apogee e confira as permissões solicitadas. Crie o plugin e instale-o. Em uma conversa, use <strong>@Apogee</strong>.</li>
    </ol>
    <p className={styles.hint}>A opção de conexão depende do seu plano e das permissões do seu espaço no ChatGPT. <a href="https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt" target="_blank" rel="noopener noreferrer">Ver instruções da OpenAI</a>.</p>
    <details className={styles.more}><summary>Já conectou a versão anterior ou usa Claude?</summary>
      <p>Conexões antigas continuam com as permissões que você já autorizou. Para organizar calendário e coleções, autorize as permissões adicionais quando solicitado. Se o aplicativo não permitir ampliar o acesso, remova a conexão antiga no aplicativo e crie uma nova.</p>
      <p>No Claude, adicione uma integração MCP com o mesmo endereço e autenticação OAuth. O login e a autorização acontecem na Apogee.</p>
    </details>
  </section>;
}

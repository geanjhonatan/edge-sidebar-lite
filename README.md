# Edge Sidebar Lite

**Uma barra lateral independente para Windows, inspirada na antiga Sidebar do Microsoft Edge.**  
*An independent Windows desktop sidebar inspired by the classic Microsoft Edge Sidebar.*

![Windows](https://img.shields.io/badge/Windows-10%20%2F%2011-0078D6) ![Electron](https://img.shields.io/badge/Electron-44.7.1-47848F) ![Versão](https://img.shields.io/badge/versão-0.4.0--beta.1-orange) ![Status](https://img.shields.io/badge/status-beta-yellow)

Acesse seus sites favoritos sem abrir um navegador completo. Fixe a barra à esquerda ou direita, use-a como janela flutuante ou reserve uma faixa exclusiva do desktop para que outros aplicativos maximizados respeitem o espaço da Sidebar.

> [!IMPORTANT]
> **Versão beta para testes. Ainda não existe uma distribuição oficialmente assinada.** O código de assinatura e as verificações de segurança estão preparados, mas exigem um certificado de assinatura de código legítimo. O download e a instalação automáticos de executáveis permanecem **desabilitados** nesta versão. Este é um projeto independente, sem vínculo com a Microsoft.

## 📸 Capturas de tela

<p align="center">
  <img src="https://github.com/user-attachments/assets/173a5647-83c7-404f-876e-364d760c267c" alt="Edge Sidebar Lite: painel e sites" width="360" />
  <img src="https://github.com/user-attachments/assets/7143d06e-df63-4e68-a0d7-b09cd7141144" alt="Edge Sidebar Lite: painel de configurações" width="360" />
</p>

## ✨ Funcionalidades

| Recurso | O que faz |
|---|---|
| 📌 Barra fixa e flutuante | Escolha o lado do monitor ou mova a janela. |
| 🖥️ Reserva de espaço | Integração experimental com Windows AppBar para evitar sobreposição. |
| ➕ Sites ilimitados | Adicione, edite e reorganize atalhos com favicons automáticos. |
| ◀️ ▶️ Navegação | Voltar, avançar, recarregar e visualizar o endereço. |
| 🖱️ Botão direito | Menus de contexto e opções para links. |
| 🌐 Links externos | Escolha onde abrir links que solicitam uma nova aba. |
| 🎵 Áudio protegido | Ícone 🔊 na aba que toca música; páginas com áudio não são descartadas pelo cache de 3 abas comuns. |
| 💾 Configurações seguras | Salvamento atômico e backup para reduzir risco de perda de atalhos. |
| 🔄 Central de atualizações | Consulta versões e notas no GitHub Releases; instalação automática bloqueada até existir assinatura validada. |
| 🚀 Inicialização no Windows | Pode iniciar automaticamente ao entrar no Windows quando instalado. |
| 🎨 Aparência | Largura, posição, cores e preferências. |

**Importante:** sites incorporados podem restringir login, autenticação Google, permissões ou reprodução. Quando um login externo não é compatível, utilize o navegador habitual — a sessão externa não é transferida à Sidebar.

## 💻 Instalação para desenvolvedores

Requisitos: **Windows 10 x64**, Node.js e npm. Windows 11 e configurações com vários monitores ainda precisam de validação ampla.

```powershell
git clone https://github.com/geanjhonatan/edge-sidebar-lite.git
cd edge-sidebar-lite
npm ci
npm run check
npm test
npm start
```

**Gerar instalador local de TESTE (sem assinatura):**

```powershell
npm run dist:win
```

O arquivo aparecerá em `dist/`. **Não distribua instaladores de teste como se fossem assinados.** A compilação no GitHub Actions também gera artefatos temporários para validação, não uma Release estável.

## 🔄 Atualizações

O aplicativo tem uma seção **Configurações → Atualizações**, que permite consultar o GitHub Releases e ver novidades de novas versões. A infraestrutura do `electron-updater` já está integrada, mas a instalação automática está protegida por uma política explícita:

- `src/update-security.json` mantém `enabled: false` até configurar e validar o certificado do publicador.
- Não basta alterar essa opção: é necessário assinar, testar o fluxo de instalação e confirmar a identidade da assinatura.
- **Ainda não existe nenhuma GitHub Release pública oficial**; a aba Releases será utilizada após a validação de segurança.

Consulte [o guia de atualizações](docs/ETAPA3-ATUALIZACOES.md) e [o guia de distribuição assinada](docs/ETAPA4-DISTRIBUICAO-ASSINADA.md). **Não envie chaves privadas, PINs ou certificados com chave privada para Issues ou pull requests.**

## 🏗️ Arquitetura

- `src/main.js`: processo principal, sessões, janelas e IPC.
- `src/renderer/`: interface, navegação e configurações.
- `src/windows-appbar.js`: registro da faixa reservada no desktop.
- `src/config-store.js`: gravação atômica, backup e recuperação.
- `src/browser-links.js`: seleção segura de navegadores externos.
- `src/update-service.js`: consulta de novas versões e estado do atualizador.
- `scripts/`: verificações do lockfile e preparação para assinatura.
- `test/`: testes de layout, AppBar, links, configurações e atualizações.

## 🔒 Segurança e privacidade

Desenvolvimento no contexto de **Security Research & App Hardening**, com testes em ambientes autorizados e controlados.

A aplicação utiliza isolamento de contexto, sandbox e sessões por site. Os cookies e logins ficam no **perfil local do Electron**, fora do repositório; **não** sincroniza seus dados com um servidor do projeto. Nenhum navegador incorporado elimina os riscos de sites externos. Evite usar contas críticas enquanto a aplicação estiver em beta e sem uma auditoria completa das dependências.

## 🗺️ Roadmap

- [x] Barra lateral fixa, flutuante e personalizável.
- [x] Espaço reservado no desktop e atalhos ilimitados.
- [x] Indicador de áudio e proteção de abas com música.
- [x] Persistência robusta de configurações.
- [x] Central de consulta de atualizações (somente leitura nesta beta).
- [x] Preparação de build e verificação de assinatura.
- [ ] Certificado Authenticode válido e testes de assinatura no Windows.
- [ ] Teste de atualização real entre duas versões assinadas.
- [ ] Release estável com instalador assinado.
- [ ] Validação ampla de desempenho, DPI e múltiplos monitores.

## 🤝 Contribuições e licença

Encontrou um bug? Abra uma [Issue](https://github.com/geanjhonatan/edge-sidebar-lite/issues) com a versão do Windows e como reproduzir o problema (sem cookies, tokens ou dados sensíveis).

**Licença:** ainda não foi definida uma licença open source. Código visível no GitHub **não concede automaticamente** permissão de redistribuição ou criação de derivados. Uma licença será escolhida antes da distribuição estável.

---

Desenvolvido por [geanjhonatan](https://github.com/geanjhonatan) · ⭐ Se gostou do projeto, deixe uma estrela!

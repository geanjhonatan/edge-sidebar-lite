# 🪟 Edge Sidebar Lite

**Uma barra lateral independente para Windows, inspirada na antiga Sidebar do Microsoft Edge.**

*An independent desktop sidebar for Windows, inspired by the classic Microsoft Edge Sidebar.*

![Windows](https://img.shields.io/badge/Windows-10%20%2F%2011-0078D6?logo=windows)
![Electron](https://img.shields.io/badge/Framework-Electron-47848F?logo=electron)
![Principal](https://img.shields.io/badge/branch%20main-v0.2.0-4f8cff)
![Prévia](https://img.shields.io/badge/pr%C3%A9via-v0.3.0-orange)
![Status](https://img.shields.io/badge/status-em%20desenvolvimento-yellow)

Transforme seus sites favoritos em atalhos acessíveis diretamente da área de trabalho. **Fixe a Sidebar à esquerda ou à direita, use uma janela flutuante ou reserve uma faixa exclusiva no Windows**, sem precisar manter o Microsoft Edge aberto.

> [!NOTE]
> Projeto comunitário **independente e não oficial**. Não possui vínculo, aprovação ou suporte da Microsoft.

## 📸 Prévia do aplicativo

<p align="center">
  <img src="https://github.com/user-attachments/assets/173a5647-83c7-404f-876e-364d760c267c" alt="Edge Sidebar Lite — interface e navegação" width="380" />
  <img src="https://github.com/user-attachments/assets/7143d06e-df63-4e68-a0d7-b09cd7141144" alt="Edge Sidebar Lite — personalização e painel lateral" width="380" />
</p>

## ✨ Funcionalidades

| Recurso | Descrição |
| --- | --- |
| 📌 **Barra fixada ou flutuante** | Encaixe na borda do monitor ou use uma janela independente e movimentável. |
| 🖥️ **Espaço reservado** | Integração experimental com a API AppBar para que janelas maximizadas respeitem a área da Sidebar. |
| ↔️ **Posição e tamanho** | Alternância entre esquerda/direita, expansão, recolhimento e ajuste de largura. |
| 🌐 **Sites ilimitados** | Cadastre URLs HTTPS, edite nomes, exclua e reorganize atalhos. |
| 🖼️ **Favicons** | Identificação automática dos ícones dos sites, quando disponíveis. |
| ⬅️ **Navegação** | Voltar, avançar, recarregar e visualizar o endereço atual. |
| 🎨 **Personalização** | Cores, aparência, opacidade e opção de manter no topo. |
| 🔐 **Sessões individuais** | Cada site tem uma partição persistente de dados locais no Electron. |
| 🧠 **Carregamento controlado** | Limita o número de visualizações web simultâneas. |
| 🗂️ **Bandeja do sistema** | Ocultar e reabrir a Sidebar sem fechar o aplicativo. |

### 🧪 Novidades da v0.3.0 — versão de testes

A **v0.3.0 está no [Pull Request #1](https://github.com/geanjhonatan/edge-sidebar-lite/pull/1)** e **ainda não faz parte da branch `main`**.

- 🔗 **Escolha do navegador ao abrir links em novas abas:** abrir na própria Sidebar, no navegador padrão ou em navegadores detectados (como Edge, Chrome, Vivaldi, Firefox, Brave e Opera).
- 🚀 **Iniciar com o Windows:** opção no aplicativo **instalado**.
- 📦 **Instalador `.exe` (NSIS):** criado automaticamente pelo GitHub Actions.
- 🛡️ **Atualização de dependências:** Electron 44.7.1 e electron-builder 26.17.0 nesta prévia.

**Limitação:** o seletor aparece para links que solicitam **nova janela ou aba** (`target="_blank"` / `window.open`), não para toda navegação normal dentro de um site.

## 📥 Instalação

### Opção A — Instalador experimental da v0.3.0

O build Windows e os testes automatizados do PR foram concluídos com sucesso. **O instalador ainda não é uma Release oficial**, não é assinado digitalmente e precisa de validação gráfica em mais computadores.

1. Abra o [build Windows da v0.3.0](https://github.com/geanjhonatan/edge-sidebar-lite/actions/runs/38456734124).
2. Na seção **Artifacts**, baixe `edge-sidebar-lite-windows-installer` (talvez seja necessário entrar no GitHub).
3. Extraia o ZIP e execute o instalador `.exe`.

> [!WARNING]
> Artefatos do GitHub Actions têm prazo de retenção e podem expirar. Se o link não estiver disponível, consulte o [PR #1](https://github.com/geanjhonatan/edge-sidebar-lite/pull/1) para localizar um build mais recente. Como o executável não é assinado, o Windows pode apresentar um alerta de segurança. Use apenas em ambiente de teste controlado.

### Opção B — Executar o código-fonte da versão principal (v0.2.0)

Requisitos: **Windows 10 x64**, Node.js, npm e Git instalados.

Abra o PowerShell e execute:

```powershell
git clone https://github.com/geanjhonatan/edge-sidebar-lite.git
cd edge-sidebar-lite
npm install
npm run check
npm test
npm start
```

Para testar o código da **v0.3.0**, antes de instalar as dependências, altere para a branch do PR:

```powershell
git switch feature/v0.3-installer-browser-choice
npm install
npm run check
npm test
npm start
```

A integração de reserva de espaço usa a dependência nativa `koffi` no Windows. Se ela não puder ser carregada, a barra pode continuar funcionando sem reservar a área da tela.

### Gerar o instalador localmente

Dentro da pasta da **branch v0.3.0**, no PowerShell do Windows:

```powershell
npm install
npm run check
npm test
npm run dist:win
```

O arquivo gerado aparecerá na pasta `dist/`. Execute e teste o instalador antes de compartilhá-lo.

## ⚙️ Como usar

1. Clique no botão **+** da Sidebar para cadastrar um site HTTPS.
2. Selecione um ícone para abrir o site no painel.
3. Use **Voltar**, **Avançar** e **Recarregar** para navegar.
4. Em **Configurações**, personalize aparência, lado e largura.
5. Para manter seu próprio espaço no desktop, ative **Fixar na borda do monitor** e **Reservar espaço no Windows ao fixar a barra**.
6. Na **v0.3.0 instalada**, ative **Iniciar com o Windows** para abrir automaticamente ao entrar na sua conta.

> Alguns serviços podem limitar login, reprodução de mídia ou links em visualizações incorporadas. Não há garantia de compatibilidade com todos os sites.

## 🧱 Tecnologias e organização

**Electron · Node.js · JavaScript · HTML · CSS · Windows AppBar · Koffi**

```text
edge-sidebar-lite/
├── src/
│   ├── main.js                # Janela, sessões e eventos do Electron
│   ├── preload.js             # API controlada para a interface
│   ├── windows-appbar.js      # Reserva de espaço na área de trabalho
│   ├── browser-links.js      # Escolha de navegador (somente v0.3)
│   └── renderer/
│       ├── index.html
│       ├── styles.css
│       └── app.js
├── test/
│   ├── layout.test.js
│   ├── appbar.test.js
│   └── browser-links.test.js  # Somente v0.3
└── package.json
```

## 🔒 Privacidade e segurança

Projeto desenvolvido no contexto de **Security Research & App Hardening**, com testes de robustez em ambientes controlados.

- **Cookies e dados de login não estão incluídos no código-fonte:** as sessões persistentes são armazenadas no perfil local do Electron, no dispositivo do usuário.
- O projeto isola sessões por site e aplica restrições de navegação e permissões ao conteúdo incorporado.
- A branch principal ainda usa Electron **30.5.1**; a prévia atualiza para **44.7.1**, mas **isso não substitui uma auditoria das dependências**.
- Nunca publique pastas de perfis, arquivos de cookies, tokens, senhas ou arquivos `.env` em Issues e Pull Requests.
- Evite usar contas sensíveis até que o aplicativo e suas dependências tenham passado por uma revisão de segurança adequada.

## 🗺️ Roadmap

- [x] Barra independente, recolhível e personalizável.
- [x] Atalhos ilimitados, favicons e navegação.
- [x] Reserva experimental de espaço no Windows.
- [x] Build experimental de instalador Windows (v0.3, via PR).
- [x] Seletor de navegador e início com Windows (implementados na prévia v0.3).
- [ ] Validar instalador e integração AppBar em diferentes máquinas e monitores.
- [ ] Revisar alertas de segurança e atualizar dependências após testes.
- [ ] Publicar **Release estável** com instalador revisado.
- [ ] Melhorar acessibilidade, experiência de uso e suporte a Windows 11.

## 🤝 Contribuir

Relatos de bugs, ideias e contribuições são bem-vindos. Abra uma [Issue](https://github.com/geanjhonatan/edge-sidebar-lite/issues) com passos de reprodução, versão do Windows e capturas de tela **sem dados pessoais**.

## 📄 Licença

**Ainda não há uma licença de código aberto definida.** Até que seja escolhida e adicionada ao repositório, o código público não possui uma autorização geral para redistribuição ou criação de versões derivadas.

---

<p align="center">
  Feito por <a href="https://github.com/geanjhonatan">geanjhonatan</a> ·
  <a href="https://github.com/geanjhonatan/edge-sidebar-lite/issues">Reportar problema</a> ·
  <a href="https://github.com/geanjhonatan/edge-sidebar-lite/pull/1">Testar v0.3</a>
  <br /><br />
  ⭐ Gostou do projeto? Deixe uma estrela no repositório!
</p>

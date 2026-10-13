# Edge Sidebar Lite 0.3 — Instalador e links externos

## O que mudou

- Links de sites que abrem novas janelas/abas agora exibem uma pergunta com opções para abrir na Sidebar, no navegador padrão, Edge, Chrome, Vivaldi, Firefox, Brave ou Opera (quando detectados), copiar ou cancelar.
- Só permitimos endereços HTTP/HTTPS, recusando esquemas perigosos.
- **Iniciar com o Windows** nas configurações e na bandeja (disponível no executável instalado).
- Atualização de Electron para 44.7.1 e electron-builder 26.17.0.

## Construir localmente no Windows

1. Feche completamente a Sidebar anterior e faça backup do projeto.
2. Abra PowerShell na pasta do projeto.
3. Execute:

```powershell
npm install
npm run check
npm test
npm run dist:win
```

O instalador NSIS aparecerá em `dist/*.exe`.

## Construir via GitHub

Na aba Actions, abra **Windows installer (test build)** e baixe o artefato `edge-sidebar-lite-windows-installer` após o job concluir. Ele contém o instalador `.exe`. O workflow **não publica uma Release** automaticamente.

## Limitações e segurança

- O seletor de navegador é exibido para links que solicitam nova janela (`target=_blank` ou `window.open`), não para cada mudança de página normal.
- Navegadores instalados em caminhos personalizados podem não aparecer (há opção de navegador padrão).
- Electron 44 e integração AppBar devem passar por testes gráficos no Windows antes de liberar publicamente.
- Executável sem assinatura de código: pode exibir aviso do SmartScreen.
- Dados de sessão e cookies ficam no perfil local do aplicativo e **não** entram no instalador nem no repositório.

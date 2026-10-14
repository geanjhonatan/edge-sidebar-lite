# Edge Sidebar Lite — Navegação (Voltar / Avançar / Recarregar)

## O que mudou

- Uma barra de navegação compacta aparece no topo da área do site, com Voltar, Avançar, Recarregar e endereço atual.
- O conteúdo de cada site fica abaixo dessa barra, para que o `WebContentsView` nativo não intercepte cliques.
- Voltar e Avançar são desativados quando não existe histórico naquela direção.
- Cada site tem seu próprio histórico. O cache das últimas 3 views continua funcionando.
- Navegação SPA (URLs alteradas sem recarregar) atualiza o estado da barra.
- IPC valida a origem e aceita apenas `back`, `forward` ou `reload`.
- A barra de navegação não interfere na opção de painel à esquerda/direita, janela flutuante, configurações, sites, favicons e sessões.

## Instalação (Windows 10)

1. Feche a Sidebar pelo menu da bandeja (`Sair`) e pare `npm start` com Ctrl+C.
2. Faça backup de `C:\Users\geanr\edge-sidebar-lite\src`.
3. Extraia este ZIP na pasta `C:\Users\geanr\edge-sidebar-lite`, substituindo os arquivos existentes (o ZIP contém `src` diretamente na raiz).
4. No PowerShell, dentro dessa pasta:

```powershell
npm run check
npm test
npm start
```

Se já tem as dependências instaladas, não precisa executar `npm install` novamente.

## Testes automatizados

`npm run check` e `npm test` passaram no ambiente de desenvolvimento. Os testes usam simulações de Electron e verificam histórico, navegação, área reservada aos controles, posicionamento, configurações e isolamento entre sites. A renderização gráfica e a navegação real precisam ser confirmadas no Windows.

## Notas de segurança

Contexto de Security Research & App Hardening: testes controlados. A Sidebar não é um bloqueador de anúncios nem uma proteção antivírus. O projeto mantém o Electron 30.5.1; antes de usar contas sensíveis, recomenda-se planejar a migração para uma versão atualizada e revisar permissões e armazenamento de sessões.

# Changelog

Todas as alterações relevantes serão registradas aqui. Este histórico acompanha as versões do código-fonte. A v0.4.0-beta.1 é uma prévia sem instalador assinado, não uma Release estável.

## [0.4.0-beta.1 + Etapa 4] — Preparação da distribuição assinada (código publicado)

### Adicionado
- Configuração de assinatura Authenticode para `electron-builder` v26, exigindo `forceCodeSigning`.
- Script de build manual assinado que habilita updater somente no binário de release e restaura a política de origem.
- Script PowerShell de verificação pós-build: instalador/EXE interno, identidade do publicador e manifesto de atualização.
- Workflow GitHub Actions exclusivamente manual em runner Windows dedicado com token/HSM e revisão por ambiente.
- Testes de preflight para bloquear assinatura falsa/ausente e publicação automática sem aprovação.
- Guia com opções práticas de assinatura, restrições de identidade e checklist antes de Releases.

### Limitações
- Ainda não há certificado de publicador fornecido/configurado, portanto **nenhum executável foi assinado**.
- Lockfile sincronizado e verificado em ambiente de CI; testes do instalador assinado ainda pendentes.

## [0.4.0-beta.1] — Prévia do sistema de atualizações

### Adicionado
- Central de atualizações na interface de Configurações.
- Exibição da versão instalada, notas de release, verificação automática ao iniciar (no aplicativo empacotado), manual e estado de conexão.
- Preferências locais para verificação automática, download automático e instalação ao fechar.
- Aviso nativo de atualização disponível em builds empacotados, quando o sistema suportar notificações.
- Botões de adiar atualização, ver Releases, baixar com progresso e instalar/reiniciar.
- Implementação de `electron-updater` com proteção explícita de **não instalar** enquanto não houver assinatura digital.
- Leitura controlada da API pública do GitHub Releases; URLs e texto não são executados.
- Testes simulados de verificação, erros de rede, versões, adiamento e instalação assinada.

### Segurança
- Em builds experimentais não assinados, somente a **verificação de versões** fica disponível. Download e instalação automática são bloqueados.
- Sessões por site, indicador de música, AppBar, config atômica e proteção de permissões preservados.

### Pendente antes do lançamento
- Executar `npm audit` no CI e revisar eventuais alertas; o lockfile já foi sincronizado.
- Configuração de certificado Authenticode de publicador e teste de atualizações entre dois instaladores no Windows.
- Verificação de assinatura e auditoria de dependências, assinatura dos metadados e release com latest.yml / blockmap.

## [0.3.1 + Etapa 2] — Base local

- Correções do menu de contexto, largura e seletor de navegadores.
- Assistência para login Google incompatível com navegadores incorporados.
- Proteção de abas com áudio e indicador 🔊 confirmados pelo usuário no Windows.
- Persistência atômica do `config.json` com backup e recuperação.

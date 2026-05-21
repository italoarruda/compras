# Contribuindo

Obrigado por contribuir! Siga estas diretrizes para manter a qualidade do projeto.

## Fluxo de Trabalho

1. Fork o repositório
2. Crie uma branch descritiva: `git checkout -b feat/nome-da-feature`
3. Faça suas alterações com commits semânticos
4. Rode os testes: `npm test` / `pnpm test` / `pytest tests/`
5. Push: `git push origin feat/nome-da-feature`
6. Abra um Pull Request usando o template disponível

## Padrão de Commits (Conventional Commits)

| Prefixo | Uso |
|---------|-----|
| `feat:` | Nova funcionalidade |
| `fix:` | Correção de bug |
| `docs:` | Atualização de documentação |
| `style:` | Formatação, sem mudança de lógica |
| `refactor:` | Refatoração de código |
| `test:` | Adição ou correção de testes |
| `chore:` | Build, CI/CD, dependências |
| `perf:` | Melhorias de performance |
| `security:` | Correções de segurança |

## Configuração do Ambiente

```bash
# Clone o repositório
git clone https://github.com/italoarruda/<projeto>.git
cd <projeto>

# Configure as variáveis de ambiente
cp .env.example .env
# Edite o .env com suas credenciais

# Instale as dependências
npm install   # ou: pnpm install / pip install -r requirements.txt
```

## Rodando Testes

```bash
# JavaScript/TypeScript
npm test          # ou pnpm test

# Python
pytest tests/ -v
```

## Reporte de Bugs

Use o template de issue `.github/ISSUE_TEMPLATE/bug_report.md`.

## Código de Conduta

Este projeto segue o [Contributor Covenant](https://www.contributor-covenant.org/). Seja respeitoso.

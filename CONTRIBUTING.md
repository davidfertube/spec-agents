# Contributing to SpecVault

Thank you for your interest in contributing to SpecVault! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Quick Start](#quick-start)
- [Development Setup](#development-setup)
- [Code Style](#code-style)
- [Pull Request Process](#pull-request-process)
- [Areas for Contribution](#areas-for-contribution)
- [Reporting Bugs](#reporting-bugs)
- [Requesting Features](#requesting-features)

## Quick Start

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/specvault`
3. Install dependencies: `npm install`
4. Copy environment file: `cp .env.example .env.local`
5. Start development: `npm run dev`

## Development Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- Git

### Environment Variables

Copy `.env.example` to `.env.local` and configure:

```bash
# Required for full functionality
ANTHROPIC_API_KEY=your_anthropic_key    # Claude Sonnet 4.5 (primary LLM)
VOYAGE_API_KEY=your_voyage_api_key      # Voyage AI embeddings
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Running Locally

```bash
# Start the development server
npm run dev

# Run tests
npm test

# Run linting
npm run lint

# Build for production
npm run build
```

## Code Style

### TypeScript

- Use TypeScript strict mode
- Prefer explicit types over `any`
- Use interfaces for object shapes
- Follow existing patterns in the codebase

### React

- Use functional components with hooks
- Keep components focused and single-purpose
- Use descriptive prop names
- Prefer composition over inheritance

### CSS/Styling

- Use Tailwind CSS utility classes
- Follow the existing design system (see `globals.css`)
- Maintain responsive design principles

### Commits

- Use clear, descriptive commit messages
- Start with a verb: "Add", "Fix", "Update", "Remove"
- Reference issue numbers when applicable

## Pull Request Process

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Write clean, documented code
   - Add tests for new functionality
   - Update documentation if needed

3. **Test your changes**
   ```bash
   npm test
   npm run lint
   npm run build
   ```

4. **Submit your PR**
   - Fill out the PR template completely
   - Link related issues
   - Add screenshots for UI changes

5. **Code Review**
   - Address reviewer feedback promptly
   - Keep discussions constructive
   - Squash commits before merge if requested

## Areas for Contribution

We welcome contributions in these areas:

### High Priority

- [ ] BGE cross-encoder re-ranking (replace LLM reranking for faster scoring)
- [ ] Additional document format support (Word, Excel)
- [ ] User authentication + multi-tenant workspace isolation
- [ ] In-app PDF viewer with citation highlighting
- [ ] Expand golden datasets to 100+ queries per spec

### Medium Priority

- [ ] Cost tracking dashboard for token usage
- [ ] Metadata filtering for document search
- [ ] UI/UX improvements and accessibility
- [ ] REST API for workflow integration

### Good First Issues

- [ ] Add more example queries for different steel grades
- [ ] Improve error messages and user feedback
- [ ] Write evaluation test cases for edge cases

## Reporting Bugs

When reporting bugs, please include:

1. **Description**: Clear description of the bug
2. **Steps to Reproduce**: Numbered steps to reproduce the issue
3. **Expected Behavior**: What should happen
4. **Actual Behavior**: What actually happens
5. **Environment**: Browser, OS, Node version
6. **Screenshots**: If applicable

Use the [Bug Report Template](.github/ISSUE_TEMPLATE/bug_report.md).

## Requesting Features

When requesting features, please include:

1. **Problem**: What problem does this solve?
2. **Proposed Solution**: How would you implement it?
3. **Alternatives**: What alternatives did you consider?
4. **Additional Context**: Any other relevant information

Use the [Feature Request Template](.github/ISSUE_TEMPLATE/feature_request.md).

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on constructive feedback
- Assume good intentions

## Questions?

- Open a [Discussion](https://github.com/davidfertube/specvault/discussions)
- Check existing [Issues](https://github.com/davidfertube/specvault/issues)
- Read the [Documentation](README.md)

Thank you for contributing!

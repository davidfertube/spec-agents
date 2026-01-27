# Contributing to Steel Venture

Thank you for your interest in contributing to Steel Venture! This document provides guidelines and instructions for contributing.

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
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/steel-venture`
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
GOOGLE_API_KEY=your_google_api_key
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

- [ ] Improve document chunking strategies for better RAG results
- [ ] Add support for additional document formats (Word, Excel)
- [ ] Improve citation accuracy and source attribution
- [ ] Performance optimizations for large document sets

### Medium Priority

- [ ] Add evaluation benchmarks for RAG quality
- [ ] Implement query rewriting for better search
- [ ] Add metadata filtering for document search
- [ ] UI/UX improvements and accessibility

### Good First Issues

- [ ] Add more example queries for different steel grades
- [ ] Improve error messages and user feedback
- [ ] Add loading states and animations
- [ ] Documentation improvements

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

- Open a [Discussion](https://github.com/davidfertube/steel-venture/discussions)
- Check existing [Issues](https://github.com/davidfertube/steel-venture/issues)
- Read the [Documentation](README.md)

Thank you for contributing!

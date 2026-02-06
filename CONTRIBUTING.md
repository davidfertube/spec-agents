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
VOYAGE_API_KEY=your_voyage_api_key      # Voyage AI embeddings
GROQ_API_KEY=your_groq_api_key          # Groq LLM
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

## AI Agent Development Workflow (2026 Best Practices)

### Setting Up for Agent Development

1. **Install AI Development Tools**:
   ```bash
   # LangGraph for multi-agent workflows
   npm install @langchain/langgraph @langchain/core

   # LangSmith for tracing and debugging
   export LANGSMITH_API_KEY=your_key
   export LANGSMITH_TRACING=true

   # Evaluation frameworks
   npm install ragas deepeval
   ```

2. **Configure MCP (Model Context Protocol)**:
   ```json
   // ~/.config/claude/claude_desktop_config.json
   {
     "mcpServers": {
       "supabase": {
         "command": "npx",
         "args": ["-y", "@modelcontextprotocol/server-supabase"],
         "env": {
           "SUPABASE_URL": "your-url",
           "SUPABASE_SERVICE_KEY": "your-key"
         }
       }
     }
   }
   ```

3. **Run Development Server with Hot Reload**:
   ```bash
   npm run dev
   # API available at http://localhost:3000/api
   ```

### Agent Development Checklist

When adding new agentic capabilities:

- [ ] **Design**: Document agent reasoning pattern (ReAct/Plan-Execute/Reflection)
- [ ] **Tools**: Define tool schemas with clear descriptions
- [ ] **Memory**: Specify short-term (conversation) vs long-term (RAG) memory needs
- [ ] **Evaluation**: Create golden dataset (10+ test cases)
- [ ] **Observability**: Add tracing with LangSmith/OpenTelemetry
- [ ] **Error Handling**: Implement fallbacks and graceful degradation
- [ ] **Cost Tracking**: Monitor token usage and API costs
- [ ] **Documentation**: Update AI-AGENTS.md with new patterns

### Testing AI Agents

```typescript
// tests/agents/compliance-agent.test.ts
import { describe, it, expect } from "vitest";
import { ComplianceAgent } from "@/lib/agents/compliance";

describe("ComplianceAgent", () => {
  const agent = new ComplianceAgent();

  it("should correctly identify compliant materials", async () => {
    const result = await agent.checkCompliance({
      material: "S32205",
      specification: "NACE MR0175",
      service: "sour"
    });

    expect(result.compliant).toBe(true);
    expect(result.citations).toHaveLength(3);  // Multiple sources
  });

  it("should handle unknown materials gracefully", async () => {
    const result = await agent.checkCompliance({
      material: "XYZ999",
      specification: "ASTM A790"
    });

    expect(result.compliant).toBe(false);
    expect(result.reason).toContain("not found in database");
  });
});
```

### Evaluation-Driven Development

1. **Create Test Dataset First**:
   ```json
   // tests/evaluation/compliance-dataset.json
   {
     "test_cases": [
       {
         "id": "COMP-001",
         "input": {
           "material": "S32205",
           "spec": "NACE MR0175"
         },
         "expected_output": {
           "compliant": true,
           "hardness": "≤ 22 HRC",
           "citations": ["NACE MR0175 Table A.1"]
         }
       }
     ]
   }
   ```

2. **Run Evaluation Before PR**:
   ```bash
   npm run eval:compliance
   # Output: 18/20 passed (90% accuracy)
   ```

3. **Track Regressions**:
   ```bash
   git add tests/evaluation/results/
   git commit -m "eval: Compliance agent accuracy 90% → 95%"
   ```

## Areas for Contribution

We welcome contributions in these areas:

### High Priority (Agentic AI)

- [ ] **Multi-Agent Orchestration**: Implement LangGraph workflow for specialist agents
- [ ] **MCP Server Integration**: Build custom MCP servers for PDF processing
- [ ] **Evaluation Framework**: Expand golden datasets to 100+ queries per spec
- [ ] **Self-Correction Loop**: Add reflection agent for citation verification
- [ ] **Query Decomposition**: Split complex multi-part questions into sub-queries

### High Priority (RAG Improvements)

- [ ] Improve document chunking strategies (preserve tables)
- [ ] Add support for additional document formats (Word, Excel)
- [ ] Implement reranking with Cohere or Jina
- [ ] Performance optimizations for large document sets

### Medium Priority

- [ ] **Observability**: Integrate LangSmith or Helicone for trace debugging
- [ ] **Cost Tracking**: Dashboard for token usage and API costs
- [ ] Implement query rewriting for better search
- [ ] Add metadata filtering for document search
- [ ] UI/UX improvements and accessibility

### Good First Issues

- [ ] Add more example queries for different steel grades
- [ ] Improve error messages and user feedback
- [ ] Add loading states and animations
- [ ] Create MCP tool definitions documentation
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

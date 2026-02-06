# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please follow these steps:

### Do

- **Report privately**: Email security concerns to the repository maintainers
- **Provide details**: Include steps to reproduce, potential impact, and suggested fixes
- **Allow time**: Give us reasonable time to address the issue before public disclosure
- **Be responsible**: Do not exploit vulnerabilities beyond what's necessary to demonstrate the issue

### Do Not

- **Do not** open public issues for security vulnerabilities
- **Do not** exploit vulnerabilities for personal gain
- **Do not** access or modify other users' data
- **Do not** perform denial of service attacks

## Security Measures

### Current Protections

- **Input Validation**: All API endpoints validate input length and format
- **File Size Limits**: Document uploads limited to 50MB
- **Error Handling**: Server errors do not leak internal details to clients
- **Environment Variables**: Sensitive keys stored in environment variables, not in code

### Recommended Deployment Security

When deploying SpecVault in production:

1. **API Keys**
   - Never commit API keys to version control
   - Use environment secrets in your deployment platform
   - Rotate keys regularly

2. **Authentication** (Recommended for Production)
   - Implement user authentication (e.g., Clerk, Auth0)
   - Add authorization checks to API routes
   - Use secure session management

3. **Rate Limiting** (Recommended for Production)
   - Add rate limiting to prevent abuse
   - Consider using services like Upstash or Redis

4. **HTTPS**
   - Always use HTTPS in production
   - Configure proper SSL certificates

5. **Database Security**
   - Use Row Level Security (RLS) in Supabase
   - Limit database permissions appropriately
   - Regular backups

## Security Checklist for Contributors

Before submitting code, ensure:

- [ ] No hardcoded secrets or API keys
- [ ] Input validation for all user-provided data
- [ ] Proper error handling without information leakage
- [ ] No SQL injection vulnerabilities (use parameterized queries)
- [ ] No XSS vulnerabilities (sanitize user content)
- [ ] File uploads validated for type and size
- [ ] Sensitive operations logged for audit trails

## Acknowledgments

We appreciate security researchers who help keep SpecVault safe. Responsible disclosure will be acknowledged in our release notes (with your permission).

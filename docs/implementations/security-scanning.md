# Security Scanning Implementation Guide

## 🎯 Overview

Implement comprehensive security scanning across the CI/CD pipeline to identify vulnerabilities in dependencies, containers, and code before they reach production.

## 🔒 Security Scanning Components

### 1. Container Vulnerability Scanning (Trivy)
- [ ] Scan Docker images for OS and library vulnerabilities
- [ ] Block deployments with HIGH/CRITICAL vulnerabilities
- [ ] Generate security reports

### 2. Dependency Vulnerability Scanning
- [ ] Scan npm/pnpm dependencies for known vulnerabilities
- [ ] Monitor for new vulnerabilities in existing dependencies
- [ ] Automated dependency updates for security patches

### 3. Static Application Security Testing (SAST)
- [ ] Scan source code for security anti-patterns
- [ ] Detect hardcoded secrets and credentials
- [ ] Identify potential injection vulnerabilities

### 4. Secret Scanning
- [ ] Prevent secrets from being committed to git
- [ ] Scan existing codebase for exposed secrets
- [ ] Monitor for secret leaks in CI/CD logs

## 🚀 Implementation Plan

### Phase 1: Container Security (Trivy)

#### Step 1: Add Trivy to Docker Workflow
```yaml
# .github/workflows/security-scan.yml
name: Security Scanning

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  container-security:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        app: ${{ fromJson(needs.detect-changes.outputs.matrix) }}
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Build Docker image
        run: |
          docker build -f apps/${{ matrix.app }}/Dockerfile \
            -t ${{ matrix.app }}:scan .

      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: '${{ matrix.app }}:scan'
          format: 'sarif'
          output: 'trivy-results.sarif'
          severity: 'CRITICAL,HIGH,MEDIUM'

      - name: Upload Trivy scan results
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: 'trivy-results.sarif'

      - name: Fail on HIGH/CRITICAL vulnerabilities
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: '${{ matrix.app }}:scan'
          format: 'table'
          exit-code: '1'
          severity: 'CRITICAL,HIGH'
```

#### Step 2: Configure Trivy Policies
- [ ] Create `.trivyignore` file for false positives
- [ ] Set up vulnerability database updates
- [ ] Configure severity thresholds

### Phase 2: Dependency Scanning

#### Step 1: npm/pnpm Audit Integration
```yaml
  dependency-security:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22.15.0

      - name: Setup pnpm
        uses: pnpm/action-setup@v4

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run security audit
        run: |
          pnpm audit --audit-level moderate
          pnpm audit --json > audit-results.json

      - name: Upload audit results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: dependency-audit
          path: audit-results.json
```

#### Step 2: Snyk Integration (Optional)
```yaml
      - name: Run Snyk to check for vulnerabilities
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high
```

### Phase 3: SAST (Static Application Security Testing)

#### Step 1: CodeQL Setup
```yaml
  sast-analysis:
    runs-on: ubuntu-latest
    permissions:
      security-events: write
      actions: read
      contents: read

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Initialize CodeQL
        uses: github/codeql-action/init@v3
        with:
          languages: javascript, typescript

      - name: Autobuild
        uses: github/codeql-action/autobuild@v3

      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v3
```

#### Step 2: ESLint Security Rules
```yaml
      - name: Run ESLint security scan
        run: |
          pnpm add -D eslint-plugin-security
          pnpm eslint . --ext .js,.ts,.tsx \
            --config .eslintrc.security.js \
            --format json \
            --output-file eslint-security.json
```

### Phase 4: Secret Scanning

#### Step 1: Pre-commit Secret Detection
```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/Yelp/detect-secrets
    rev: v1.4.0
    hooks:
      - id: detect-secrets
        args: ['--baseline', '.secrets.baseline']
```

#### Step 2: CI Secret Scanning
```yaml
  secret-scanning:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: TruffleHog OSS
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: main
          head: HEAD
          extra_args: --debug --only-verified
```

## 📋 Implementation Checklist

### Week 1: Container Security
- [ ] Add Trivy scanning to CI/CD pipeline
- [ ] Configure vulnerability thresholds
- [ ] Create `.trivyignore` for false positives
- [ ] Test with existing Docker images
- [ ] Set up SARIF upload to GitHub Security tab

### Week 2: Dependency Security  
- [ ] Integrate pnpm audit into CI/CD
- [ ] Set up Snyk account and token (optional)
- [ ] Configure dependency update automation
- [ ] Create security policy for dependency updates
- [ ] Test vulnerability detection and blocking

### Week 3: SAST Implementation
- [ ] Enable GitHub CodeQL
- [ ] Add ESLint security rules
- [ ] Configure custom security rules
- [ ] Test code scanning on existing codebase
- [ ] Review and triage initial findings

### Week 4: Secret Scanning
- [ ] Set up pre-commit hooks for secret detection
- [ ] Add TruffleHog to CI/CD pipeline
- [ ] Scan existing codebase for secrets
- [ ] Create secret management policy
- [ ] Train team on secret handling

## 🔧 Configuration Files

### .trivyignore
```bash
# False positives or accepted risks
CVE-2023-12345  # Reason: Not applicable to our use case
CVE-2023-67890  # Reason: Fixed in next release, low impact
```

### .eslintrc.security.js
```javascript
module.exports = {
  extends: ['plugin:security/recommended'],
  plugins: ['security'],
  rules: {
    'security/detect-object-injection': 'error',
    'security/detect-non-literal-regexp': 'error',
    'security/detect-unsafe-regex': 'error',
    'security/detect-buffer-noassert': 'error',
    'security/detect-child-process': 'error',
    'security/detect-disable-mustache-escape': 'error',
    'security/detect-eval-with-expression': 'error',
    'security/detect-no-csrf-before-method-override': 'error',
    'security/detect-non-literal-fs-filename': 'error',
    'security/detect-non-literal-require': 'error',
    'security/detect-possible-timing-attacks': 'error',
    'security/detect-pseudoRandomBytes': 'error'
  }
};
```

### Security Policy Template
```markdown
# Security Policy

## Vulnerability Severity Levels

- **CRITICAL**: Immediate fix required, block deployment
- **HIGH**: Fix within 7 days, block deployment  
- **MEDIUM**: Fix within 30 days, allow deployment with approval
- **LOW**: Fix within 90 days, allow deployment

## Dependency Update Policy

- Security patches: Auto-merge if tests pass
- Minor updates: Weekly review and update
- Major updates: Manual review and testing

## Secret Management

- Never commit secrets to git
- Use environment variables for configuration
- Rotate secrets regularly
- Use secret management tools (Vault, AWS Secrets Manager)
```

## 📊 Monitoring and Metrics

### Security Dashboards
- [ ] Vulnerability count by severity
- [ ] Time to fix vulnerabilities
- [ ] Dependency update frequency
- [ ] Secret scanning alerts

### Key Metrics
- **Mean Time to Fix (MTTF)**: Target <7 days for HIGH/CRITICAL
- **Vulnerability Density**: Target <1 HIGH/CRITICAL per 1000 LOC
- **Dependency Freshness**: Target <30 days behind latest
- **Secret Leak Prevention**: Target 0 secrets in production

## 🚨 Incident Response

### Vulnerability Discovery Process
1. **Detection**: Automated scanning identifies vulnerability
2. **Assessment**: Security team evaluates impact and severity
3. **Response**: Create fix plan and timeline
4. **Implementation**: Deploy fix and verify resolution
5. **Post-mortem**: Document lessons learned

### Emergency Response
- **CRITICAL vulnerabilities**: Immediate response team activation
- **Production secrets exposed**: Immediate rotation and access review
- **Active exploitation**: Incident response plan activation

## 💡 Best Practices

1. **Shift Left**: Catch vulnerabilities early in development
2. **Automate Everything**: Reduce manual security review overhead
3. **Continuous Monitoring**: Regular scans and updates
4. **Team Training**: Educate developers on secure coding
5. **Regular Reviews**: Periodic security policy and tool reviews

## 🎯 Success Criteria

- [ ] **Zero HIGH/CRITICAL vulnerabilities** in production
- [ ] **100% container scanning** coverage
- [ ] **<7 day MTTF** for security vulnerabilities
- [ ] **Zero secrets** committed to git
- [ ] **90%+ team compliance** with security practices

## 📚 Additional Resources

- [Trivy Documentation](https://aquasecurity.github.io/trivy/)
- [GitHub Security Features](https://docs.github.com/en/code-security)
- [OWASP Secure Coding Practices](https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/)
- [npm Security Best Practices](https://docs.npmjs.com/security)

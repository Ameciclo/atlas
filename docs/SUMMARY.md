# Atlas Documentation Summary

Welcome to the Atlas project documentation! This guide will help you navigate the available documentation and find what you need.

## 📚 Documentation Index

### Getting Started

1. **[Main README](../README.md)** - Project overview, setup, and basic usage
2. **[Creating a New Service](./CREATE_NEW_SERVICE.md)** - Step-by-step guide for creating new services
3. **[Scaffolding Tool](./SCAFFOLDING_TOOL.md)** - Detailed documentation for the `create-atlas-app` tool

### Package Documentation

4. **[Create Atlas App README](../packages/create-atlas-app/README.md)** - Scaffolding tool package documentation

## 🚀 Quick Links by Task

### I want to...

#### Create a New Service

1. Read: [Creating a New Service](./CREATE_NEW_SERVICE.md)
2. Run: `pnpm create-atlas-app`
3. Follow the prompts
4. Start developing!

**Time to first service:** ~5 minutes

#### Deploy a Service

1. Push to GitHub
2. CI/CD automatically builds and tests
3. Merge to main
4. Docker image is built and pushed
5. Deploy using Portainer

**Time to deploy:** Automatic after merge

## 📖 Documentation by Role

### For New Developers

Start here:
1. [Main README](../README.md) - Understand the project
2. [Creating a New Service](./CREATE_NEW_SERVICE.md) - Create your first service
3. [Scaffolding Tool](./SCAFFOLDING_TOOL.md) - Learn the scaffolding tool

### For Backend Developers

Focus on:
1. [Creating a New Service](./CREATE_NEW_SERVICE.md) - Service development
2. [Scaffolding Tool](./SCAFFOLDING_TOOL.md) - Tool usage and customization
3. Example services in `apps/` directory

### For DevOps Engineers

Focus on:
1. [Main README](../README.md) - CI/CD pipeline
2. [Scaffolding Tool](./SCAFFOLDING_TOOL.md) - Service structure
3. Docker configurations in each service

## 🎯 Common Workflows

### Workflow 1: Create a New Service

```bash
# 1. Create service
pnpm create-atlas-app my-service

# 2. Install dependencies
pnpm install

# 3. Start development
pnpm --filter @atlas/my-service dev

# 4. Run tests
pnpm --filter @atlas/my-service test

# 5. Commit and push
git add .
git commit -m "feat: add my-service"
git push
```

**Documentation:** [Creating a New Service](./CREATE_NEW_SERVICE.md)

### Workflow 2: Update Database Schema

```bash
# 1. Edit schema
# Edit: apps/my-service/src/db/schema.ts

# 2. Generate migration
pnpm --filter @atlas/my-service db:generate

# 3. Review migration
# Check: apps/my-service/src/db/migrations/

# 4. Run migration
pnpm --filter @atlas/my-service db:migrate

# 5. Test
pnpm --filter @atlas/my-service test
```

**Documentation:** [Creating a New Service](./CREATE_NEW_SERVICE.md) (Database section)

### Workflow 3: Deploy to Production

```bash
# 1. Create PR
git checkout -b feature/my-feature
git commit -m "feat: add feature"
git push origin feature/my-feature

# 2. CI runs automatically
# - Linting
# - Type checking
# - Tests
# - Build

# 3. Review and merge
# Merge PR to main

# 4. CD runs automatically
# - Builds Docker image
# - Pushes to ghcr.io
# - Tags with commit SHA and 'latest'

# 5. Deploy
# Use Portainer or your deployment tool
```

**Documentation:** [Main README](../README.md) (CI/CD section)

## 🔍 Finding Information

### By Topic

| Topic | Documentation |
|-------|---------------|
| Project Setup | [Main README](../README.md) |
| Creating Services | [Creating a New Service](./CREATE_NEW_SERVICE.md) |
| Scaffolding Tool | [Scaffolding Tool](./SCAFFOLDING_TOOL.md) |
| CI/CD | [Main README](../README.md) |
| Docker | [Main README](../README.md) |
| Testing | [Creating a New Service](./CREATE_NEW_SERVICE.md) |

### By Technology

| Technology | Where to Learn |
|------------|----------------|
| Hono | [Creating a New Service](./CREATE_NEW_SERVICE.md) |
| Zod OpenAPI | [Creating a New Service](./CREATE_NEW_SERVICE.md) |
| Drizzle ORM | [Creating a New Service](./CREATE_NEW_SERVICE.md) |
| PostgreSQL | [Creating a New Service](./CREATE_NEW_SERVICE.md) |
| Docker | [Main README](../README.md) |
| Turborepo | [Main README](../README.md) |
| pnpm | [Main README](../README.md) |
| TypeScript | All documentation |
| Vitest | [Creating a New Service](./CREATE_NEW_SERVICE.md) |

## 📝 Examples

### Code Examples

- **Service Creation:** `packages/create-atlas-app/src/generators/`
- **Complete Service:** `apps/cyclist-profile/`
- **Scaffolding Tool:** `packages/create-atlas-app/`

### Configuration Examples

- **TypeScript:** `packages/typescript-config/`
- **Biome:** `biome.json`
- **Turborepo:** `turbo.json`
- **Docker:** `apps/cyclist-profile/Dockerfile`
- **Docker Compose:** `apps/cyclist-profile/docker-compose.yml`
- **Drizzle:** `apps/cyclist-profile/drizzle.config.ts`

## 🆘 Getting Help

### Common Issues

1. **Build errors:** Check [Scaffolding Tool](./SCAFFOLDING_TOOL.md) troubleshooting
2. **Database issues:** See [Creating a New Service](./CREATE_NEW_SERVICE.md) database section
3. **CI/CD problems:** Check [Main README](../README.md) CI/CD section

### Where to Ask

1. **GitHub Issues:** For bugs and feature requests
2. **Pull Requests:** For code reviews and discussions
3. **Documentation:** Check this summary first

## 🔄 Keeping Documentation Updated

When you make changes:

1. **Update relevant docs** - Keep documentation in sync with code
2. **Add examples** - Show how to use new features
3. **Update this summary** - Add new documentation to the index
4. **Review ADRs** - Document architectural decisions

## 📊 Documentation Status

| Document | Status | Last Updated |
|----------|--------|--------------|
| Main README | ✅ Complete | 2025-10-15 |
| Creating a New Service | ✅ Complete | 2025-10-15 |
| Scaffolding Tool | ✅ Complete | 2025-10-15 |
| Documentation Summary | ✅ Complete | 2025-10-15 |

## 🎓 Learning Path

### Beginner (Day 1)

1. Read [Main README](../README.md)
2. Clone and setup the project
3. Run existing services
4. Explore the codebase

### Intermediate (Week 1)

1. Create a service with [Creating a New Service](./CREATE_NEW_SERVICE.md)
2. Add routes and database tables
3. Write tests
4. Deploy to staging

### Advanced (Month 1)

1. Optimize service performance
2. Add advanced features
3. Contribute to shared packages
4. Review and improve architecture

## 🚀 Next Steps

Choose your path:

- **New to Atlas?** → Start with [Main README](../README.md)
- **Creating a service?** → Go to [Creating a New Service](./CREATE_NEW_SERVICE.md)
- **Using the scaffolding tool?** → Check [Scaffolding Tool](./SCAFFOLDING_TOOL.md)
- **Need help?** → See troubleshooting sections in each guide

---

**Happy coding! 🎉**


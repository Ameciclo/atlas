# Changelog

## [1.1.0](https://github.com/Ameciclo/atlas/compare/cyclist-profile-v1.0.0...cyclist-profile-v1.1.0) (2025-11-08)


### Features

* add environment variable documentation and remove act configuration ([ce3fcee](https://github.com/Ameciclo/atlas/commit/ce3fcee5672cea7495057d5aa459607dc3ba52ee))
* add health endpoint to cyclist-profile ([7df0e74](https://github.com/Ameciclo/atlas/commit/7df0e7438abca6e384ba43a076d7f2faa4376f92))
* add SSL/TLS support with CA certificate validation ([7c9d7d6](https://github.com/Ameciclo/atlas/commit/7c9d7d6fbd054976a2be861339fe2c0e7cc73511))
* configure production API URL in OpenAPI specs ([fc32ce2](https://github.com/Ameciclo/atlas/commit/fc32ce2325ac4e451a0399d1743888d3885ffced))
* **deployment:** add Portainer webhook-based deployment strategy ([9aee9c2](https://github.com/Ameciclo/atlas/commit/9aee9c251b2871d54203d6f366384a5329402aa7))
* implement comprehensive seed system with idempotency ([17f3f2f](https://github.com/Ameciclo/atlas/commit/17f3f2f61bea00d178701f6c79d913982c0c2f48))
* **openapi:** implement industry best practices for spec management ([d88a343](https://github.com/Ameciclo/atlas/commit/d88a343881dbd9aa7fdd758af6557ecf7ba625a0))


### Bug Fixes

* biome format & lint issues ([0fef111](https://github.com/Ameciclo/atlas/commit/0fef1115ece15faf8a1d717ee7ce2a3efc94fd94))
* biome issues ([5efb8eb](https://github.com/Ameciclo/atlas/commit/5efb8eb8ac5c279de89dbacd64a5705042f9a0b0))
* **biome:** apply formatting fixes to package.json and validation script ([d53e2ac](https://github.com/Ameciclo/atlas/commit/d53e2ac1dafd6648e495dbf540a78271afbc1b45))
* build issue tsconfig ([42fee7b](https://github.com/Ameciclo/atlas/commit/42fee7b861c6013a14be2827f7ef2e512c91721c))
* build issues ([f7d657b](https://github.com/Ameciclo/atlas/commit/f7d657b1f797fd8519f169604484f51ddc552cba))
* copy seed-data to Docker images ([7973f4e](https://github.com/Ameciclo/atlas/commit/7973f4e7a5f402876c9dbdeb563c3cbed956aa66))
* correct cyclist-profile start command path ([368115c](https://github.com/Ameciclo/atlas/commit/368115c902a5ebc0e86ebaa1de224d127c56e957))
* **cyclist-profile:** add DATABASE_URL to vitest config ([ed4043b](https://github.com/Ameciclo/atlas/commit/ed4043b2ae5cb5330d8d949dd91a68c41cd19552))
* **cyclist-profile:** implement lazy database connection for OpenAPI generation ([89949f2](https://github.com/Ameciclo/atlas/commit/89949f2686495253fb816a9c29501ea90dfeaa31))
* fixed type issues ([224983b](https://github.com/Ameciclo/atlas/commit/224983b65c79f2b42d6d3797a336dcce7499ad59))
* format ([c9dfd56](https://github.com/Ameciclo/atlas/commit/c9dfd5697c88f1ab361c54f43a3a32002e6dd89b))
* more ci fix ([2fbd10d](https://github.com/Ameciclo/atlas/commit/2fbd10d5b8dbc2c59f50db92fc9d446599405b81))
* seed and migration script ([e7e45d1](https://github.com/Ameciclo/atlas/commit/e7e45d12987fc167ca7983ba2c2a8f12fc7392d4))
* use getSSLConfig() in both apps for proper SSL handling ([2e90f87](https://github.com/Ameciclo/atlas/commit/2e90f8791aaf268147cb5f44ce871e89f14899ab))


### Styles

* fix biome formatting and linting issues ([2c850e8](https://github.com/Ameciclo/atlas/commit/2c850e8469bd5241cda397f1c2681220ec2b906a))


### Code Refactoring

* centralize SSL configuration in database package ([3f499f2](https://github.com/Ameciclo/atlas/commit/3f499f28ee1b0c0f8cc65e5e902618de537f98b9))
* consolidate docker configuration and update app structure ([732a8e3](https://github.com/Ameciclo/atlas/commit/732a8e3df363efc2aebee571b70a0aee317523ec))
* **cyclist-profile:** clean separation of concerns for OpenAPI generation ([347b25e](https://github.com/Ameciclo/atlas/commit/347b25ecfd5c0d9e0abdd26cb9ad8aae1df13de4))
* **cyclist-profile:** migrate to shared database package ([282b8b3](https://github.com/Ameciclo/atlas/commit/282b8b3209885ac36f78c2dc0c87501d7f9017a4))
* simplify SSL configuration logic ([58036e3](https://github.com/Ameciclo/atlas/commit/58036e39f312d011b94fbe4d7212fd998cae6019))

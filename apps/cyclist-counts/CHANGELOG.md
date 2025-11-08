# Changelog

## [1.1.0](https://github.com/Ameciclo/atlas/compare/cyclist-counts-v1.0.0...cyclist-counts-v1.1.0) (2025-11-08)


### Features

* add SSL/TLS support with CA certificate validation ([7c9d7d6](https://github.com/Ameciclo/atlas/commit/7c9d7d6fbd054976a2be861339fe2c0e7cc73511))
* Cyclist Counts API with shared database architecture and improved tooling ([2702074](https://github.com/Ameciclo/atlas/commit/27020749a0983f0403ea62a39265cf42eecb7122))
* **cyclist-counts:** add cyclist-counts API app with locations endpoint ([ff7001d](https://github.com/Ameciclo/atlas/commit/ff7001de16fcd64518863a7f4c0c06aa7ad993bd))
* **cyclist-counts:** add events and sessions API endpoints ([06b13a3](https://github.com/Ameciclo/atlas/commit/06b13a363641eb536386196ee738c0255ca874a1))
* implement comprehensive seed system with idempotency ([17f3f2f](https://github.com/Ameciclo/atlas/commit/17f3f2f61bea00d178701f6c79d913982c0c2f48))


### Bug Fixes

* copy seed-data to Docker images ([7973f4e](https://github.com/Ameciclo/atlas/commit/7973f4e7a5f402876c9dbdeb563c3cbed956aa66))
* **cyclist-counts:** add database package to Docker build ([5084a6d](https://github.com/Ameciclo/atlas/commit/5084a6d993e79cba142fd580f220da5c1b5601f9))
* **cyclist-counts:** add OpenAPI spec to docs app ([264bd91](https://github.com/Ameciclo/atlas/commit/264bd91a5f3816ac40da8227702afd3b13354d65))
* **cyclist-counts:** copy migrations from database package ([5d781e0](https://github.com/Ameciclo/atlas/commit/5d781e00216122d31c5f6f3bb1cf797e9e667f17))
* use getSSLConfig() in both apps for proper SSL handling ([2e90f87](https://github.com/Ameciclo/atlas/commit/2e90f8791aaf268147cb5f44ce871e89f14899ab))


### Styles

* apply biome formatting fixes ([ad8eedf](https://github.com/Ameciclo/atlas/commit/ad8eedfdc0abd7a2ab99cfd68decdf2788e262df))


### Code Refactoring

* centralize SSL configuration in database package ([3f499f2](https://github.com/Ameciclo/atlas/commit/3f499f28ee1b0c0f8cc65e5e902618de537f98b9))
* consolidate docker configuration and update app structure ([732a8e3](https://github.com/Ameciclo/atlas/commit/732a8e3df363efc2aebee571b70a0aee317523ec))
* simplify SSL configuration logic ([58036e3](https://github.com/Ameciclo/atlas/commit/58036e39f312d011b94fbe4d7212fd998cae6019))

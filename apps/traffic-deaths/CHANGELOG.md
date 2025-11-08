# Changelog

## [0.1.1](https://github.com/Ameciclo/atlas/compare/traffic-deaths-v0.1.0...traffic-deaths-v0.1.1) (2025-11-08)


### Features

* add cyclist deaths endpoint with CID-10 filtering ([1cb14e4](https://github.com/Ameciclo/atlas/commit/1cb14e42c3241f706756b5d87dfb1f0f4eabdc70))
* add database migration and seed script for traffic deaths data ([199c1d3](https://github.com/Ameciclo/atlas/commit/199c1d3d0af5e5d66c22dd484af11104eac9c014))
* add traffic-deaths API with summary endpoint ([a25fc81](https://github.com/Ameciclo/atlas/commit/a25fc81efd6cbbe28b28ea0647d5b0796fe9d528))
* add traffic-deaths API with summary endpoint ([777c822](https://github.com/Ameciclo/atlas/commit/777c822af655410008826e9c8dc613312312fa34))
* implement comprehensive seed system with idempotency ([17f3f2f](https://github.com/Ameciclo/atlas/commit/17f3f2f61bea00d178701f6c79d913982c0c2f48))
* implement real database queries for summary endpoint ([427b504](https://github.com/Ameciclo/atlas/commit/427b504a463117a38acdc82fe4659f479e380038))


### Bug Fixes

* add typescript-config dependency and fix type safety issues ([3804f44](https://github.com/Ameciclo/atlas/commit/3804f443b29806c3e12b254b69137f663a988f47))
* configure traffic-deaths app to use shared atlas_dev database ([5b2bc27](https://github.com/Ameciclo/atlas/commit/5b2bc2772b6dfc3b3152817bd9ce912aee6a90a8))
* make CSV directory configurable for seed script ([8dd74db](https://github.com/Ameciclo/atlas/commit/8dd74db03cdd57885a69c0bdd8104ecd4fe4b067))
* update traffic-deaths OpenAPI generation to copy spec to docs ([325df71](https://github.com/Ameciclo/atlas/commit/325df7113b916ce1189b1eaec637a17f397fe8f6))


### Styles

* fix biome linting and formatting issues ([dd3f532](https://github.com/Ameciclo/atlas/commit/dd3f5320f32a95a8aa5cfd46dc900aa11bf22b6c))


### Code Refactoring

* consolidate docker configuration and update app structure ([732a8e3](https://github.com/Ameciclo/atlas/commit/732a8e3df363efc2aebee571b70a0aee317523ec))
* improve query patterns and optimize by-transport-mode endpoint ([0ea4947](https://github.com/Ameciclo/atlas/commit/0ea4947356f1cf27268114c8680376cb829e9302))


### Tests

* fix health check test by mocking db.execute ([14cf798](https://github.com/Ameciclo/atlas/commit/14cf7988014424d4bdd233d244d4ce5c0a2962d3))

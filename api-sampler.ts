const API_ENDPOINTS = {
  // CMS Pages
  PLATAFORM_HOME_PAGE: "https://cms.ameciclo.org/plataforma-de-dados",
  DOCUMENTS_PAGE: "https://cms.ameciclo.org/documentos",
  DOCUMENTS_DATA: "https://cms.ameciclo.org/documents",
  COUNTINGS_PAGE_DATA: "https://cms.ameciclo.org/contagens",
  IDECICLO_PAGE_DATA: "https://cms.ameciclo.org/ideciclo",
  PERFIL_PAGE_DATA: "https://cms.ameciclo.org/perfil",

  // API Data
  IDECICLO_DATA: "https://api.ideciclo.ameciclo.org/reviews",
  IDECICLO_STRUCTURES_DATA: "https://api.ideciclo.ameciclo.org/structures",
  IDECICLO_FORMS_DATA: "https://api.ideciclo.ameciclo.org/forms",
  PERFIL_DATA: "https://api.perfil.ameciclo.org/v1/cyclist-profile/summary/",

  COUNTINGS_SUMMARY_DATA: "https://api.garfo.ameciclo.org/cyclist-counts",
  COUNTINGS_DATA: "https://api.garfo.ameciclo.org/cyclist-counts/edition",

  OBSERVATORY_DATA: "https://api.garfo.ameciclo.org/cyclist-infra/relationsByCity",
  OBSERVATORY_DATA_WAYS: "https://api.garfo.ameciclo.org/cyclist-infra/ways",
  OBSERVATORY_DATA_ALL_WAYS: "https://api.garfo.ameciclo.org/cyclist-infra/ways/all-ways",
  OBSERVATORY_DATA_WAYS_SUMMARY: "https://api.garfo.ameciclo.org/cyclist-infra/ways/summary",
  CITIES_DATA: "https://api.garfo.ameciclo.org/cities",

  SINISTROS_SUMMARY_DATA: "https://api.garfo.ameciclo.org/traffic-crashes/summary",
  SINISTROS_GEOJSON_DATA: "https://api.garfo.ameciclo.org/traffic-crashes/geojson",
  SINISTROS_VEHICLES_DATA: "https://api.garfo.ameciclo.org/traffic-crashes/vehicles",
  SINISTROS_STREETS_SUMMARY_DATA: "https://api.garfo.ameciclo.org/traffic-crashes/streets-summary",

  // DATASUS
  DATASUS_SUMMARY_DATA: "https://api.garfo.ameciclo.org/datasus-deaths/summary",
  DATASUS_CITIES_BY_YEAR_DATA: "https://api.garfo.ameciclo.org/datasus-deaths/cities-by-year",
  DATASUS_FILTROS_DATA: "https://api.garfo.ameciclo.org/datasus-deaths/filtros",
  DATASUS_MATRIX_DATA: "https://api.garfo.ameciclo.org/datasus-deaths/matrix",
  DATASUS_CAUSAS_SECUNDARIAS_DATA: "https://api.garfo.ameciclo.org/datasus-deaths/causas-secundarias",

  // Strapi
  OBSERVATORIO_SINISTROS_PAGE_DATA: "https://do.strapi.ameciclo.org/api/plataformas-de-dados?filters[title][$eq]=Observatório de Sinistros Fatais&populate[0]=supportfiles&populate[1]=supportfiles.file&populate[2]=supportfiles.cover&populate[3]=cover&populate[4]=explanationbox",
  PLATAFORMAS_PAGE_DATA: "https://do.strapi.ameciclo.org/api/plataformas-de-dados?populate=*",

  // SAMU
  SAMU_SUMMARY_DATA: "https://api.garfo.ameciclo.org/samu-calls/summary",
  SAMU_CITIES_DATA: "https://api.garfo.ameciclo.org/samu-calls/cities",

  // Vias Inseguras
  VIAS_INSEGURAS_SUMMARY: "https://api.garfo.ameciclo.org/samu-calls/streets/summary",
  VIAS_INSEGURAS_TOP: "https://api.garfo.ameciclo.org/samu-calls/streets/top?limite=2111&intervalor=1",
  VIAS_INSEGURAS_MAP: "https://api.garfo.ameciclo.org/samu-calls/streets/map?limite=2111",
  VIAS_INSEGURAS_HISTORY: "https://api.garfo.ameciclo.org/samu-calls/streets/history",
  VIAS_INSEGURAS_SEARCH: "https://api.garfo.ameciclo.org/samu-calls/streets/search",
  VIAS_INSEGURAS_LIST: "https://api.garfo.ameciclo.org/samu-calls/streets/list"
};

async function fetchSample(url: string, name: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return { name, status: response.status, error: response.statusText };
    }
    const data = await response.json();
    return { name, status: 200, sample: Array.isArray(data) ? data.slice(0, 2) : data };
  } catch (error) {
    return { name, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function sampleAllAPIs() {
  console.log('Fetching samples from all APIs...\n');
  
  const results = await Promise.all(
    Object.entries(API_ENDPOINTS).map(([name, url]) => fetchSample(url, name))
  );

  results.forEach(result => {
    console.log(`\n=== ${result.name} ===`);
    if (result.error) {
      console.log(`❌ Error: ${result.error}`);
    } else if (result.status !== 200) {
      console.log(`⚠️  Status: ${result.status} - ${result.error}`);
    } else {
      console.log(`✅ Status: ${result.status}`);
      console.log('Sample:', JSON.stringify(result.sample, null, 2));
    }
  });
}

sampleAllAPIs().catch(console.error);
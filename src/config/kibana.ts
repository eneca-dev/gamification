const KIBANA_URL = process.env.KIBANA_URL;
if (!KIBANA_URL) {
  throw new Error('Missing required environment variable: KIBANA_URL');
}

const KIBANA_API_KEY = process.env.KIBANA_API_KEY;
if (!KIBANA_API_KEY) {
  throw new Error('Missing required environment variable: KIBANA_API_KEY');
}

export const KIBANA_SEARCH_URL = `${KIBANA_URL}/kibana/internal/search/es`;
export function buildKibanaHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'kbn-xsrf': 'true',
    'Authorization': `ApiKey ${KIBANA_API_KEY}`,
  };
}

// Список плагинов геймификации — единый источник в @/config/plugins.
// Реэкспорт для обратной совместимости (без InstallationManager).
export { PLUGIN_INDICES, PLUGIN_DISPLAY_NAMES } from '@/config/plugins';

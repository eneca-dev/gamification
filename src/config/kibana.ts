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

// Все индексы с логами запуска плагинов
export const PLUGIN_INDICES = [
  'auditor-*',
  'clashesmanager-*',
  'enecafamilies-*',
  'linksmanager-*',
  'sharemodel-*',
  'installationmanager-*',
  'sdt-*',
  'hvacautotag-*',
  'paramoperator-*',
  'apartmentlayouts-*',
  'groundanalyzer-*',
  'settorevit-*',
].join(',');

// Маппинг Properties.AppName → читаемое название (ключи — точные значения из ES)
export const PLUGIN_DISPLAY_NAMES: Record<string, string> = {
  InstallationManager: 'Installation Manager',
  ShareModel: 'Share Model',
  'ShareModel.Civil': 'Share Model Civil',
  SDT: 'SDT',
  LinksManager: 'Links Manager',
  'EnecaFamilies.Backend': 'Eneca Families',
  'EnecaFamilies.Frontend': 'Eneca Families',
  Auditor: 'Auditor',
  ApartmentLayouts: 'Apartment Layouts',
  'ClashesManager.Revit': 'Clashes Manager',
  'ClashesManager.Navis': 'Clashes Manager',
  'ClashesManager.Server': 'Clashes Manager',
  HVACAutoTag: 'HVAC Autotag',
  SetToRevit: 'Set to Revit',
  ParamOperator: 'Param Operator',
  'GroundAnalyzer.Civil': 'Ground Analyzer',
};

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

// Только плагины из утверждённого списка геймификации (без InstallationManager)
export const PLUGIN_INDICES = [
  'auditor-*', 'clashesmanager-*', 'linksmanager-*', 'sharemodel-*',
  'sdt-*', 'paramoperator-*', 'apartmentlayouts-*',
  'fasciacappings-*', 'spacesmanager-*', 'resavemodels-*', 'autoopenings-*',
  'finishing-*', 'sharedcoordinates-*', 'eneca.sharedcoordinates-*',
  'profilay-*', 'lookuptables-*', 'viewcloner-*', 'lintelstransfer-*',
  'surfacegen-*', 'quickmount-*', 'schedulestable-*',
].join(',');

// Маппинг Properties.AppName → читаемое название (ключи — точные значения из ES)
export const PLUGIN_DISPLAY_NAMES: Record<string, string> = {
  Auditor: 'Auditor',
  'ClashesManager.Revit': 'Clashes Manager',
  LinksManager: 'Links Manager',
  ShareModel: 'Share Model',
  SDT: 'Structural Design Toolkit',
  ParamOperator: 'Param Operator',
  ApartmentLayouts: 'Apartment Layouts',
  FasciaCappings: 'Fascia Cappings',
  SpacesManager: 'Spaces Manager',
  ResaveModels: 'ReSave',
  'ReSave Models': 'ReSave',
  AutoOpenings: 'Auto Openings',
  Finishing: 'Finishing',
  SharedCoordinates: 'Shared Coordinates',
  'Eneca.SharedCoordinates': 'Shared Coordinates',
  ProfiLay: 'Profi Lay',
  LookupTables: 'Lookup Tables',
  ViewCloner: 'View Cloner',
  LintelsTransfer: 'Lintels Transfer',
  SurfaceGen: 'Surface Gen',
  QuickMount: 'Quick Mount',
  SchedulesTable: 'Schedules Table',
};

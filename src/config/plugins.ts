// Единый источник списка Revit-плагинов, участвующих в геймификации.
// Клиент-безопасно: без process.env — импортируется и сервером, и клиентом.
// Производные (индексы ES, маппинг имён) строятся из PLUGINS — менять список только здесь.

export interface PluginDef {
  /** Короткое техническое имя для UI (как видит пользователь в Revit) */
  name: string;
  /** Читаемое название */
  display: string;
  /** Точные значения Properties.AppName из Elasticsearch (с учётом алиасов) */
  appNames: string[];
  /** Паттерн(ы) индекса ES */
  indices: string[];
}

// 2026-08-21: индексы переведены со старых ежемесячных ES-индексов на именованные
// Elastic data streams (logs-<plugin>-plugin) — см. sync-plugin-launches.ts в vps-scripts.
export const PLUGINS: PluginDef[] = [
  { name: 'Auditor', display: 'Auditor', appNames: ['Auditor'], indices: ['logs-auditor-plugin'] },
  { name: 'ClashesManager', display: 'Clashes Manager', appNames: ['ClashesManager.Revit'], indices: ['logs-clashesmanager-navis-plugin', 'logs-clashesmanager-revit-plugin', 'logs-clashesmanager-server-plugin'] },
  { name: 'LinksManager', display: 'Links Manager', appNames: ['LinksManager'], indices: ['logs-linksmanager-plugin'] },
  { name: 'ShareModel', display: 'Share Model', appNames: ['ShareModel'], indices: ['logs-sharemodel-plugin', 'logs-sharemodel-civil-plugin'] },
  { name: 'SDT', display: 'Structural Design Toolkit', appNames: ['SDT'], indices: ['logs-sdt-plugin'] },
  { name: 'ParamOperator', display: 'Param Operator', appNames: ['ParamOperator'], indices: ['logs-paramoperator-plugin'] },
  { name: 'ApartmentLayouts', display: 'Apartment Layouts', appNames: ['ApartmentLayouts'], indices: ['logs-apartmentlayouts-plugin'] },
  { name: 'FasciaCappings', display: 'Fascia Cappings', appNames: ['FasciaCappings'], indices: ['logs-fasciacappings-plugin'] },
  { name: 'SpacesManager', display: 'Spaces Manager', appNames: ['SpacesManager'], indices: ['logs-spacesmanager-plugin'] },
  { name: 'ResaveModels', display: 'ReSave', appNames: ['ResaveModels', 'ReSave Models'], indices: ['logs-resavemodels-plugin'] },
  { name: 'AutoOpenings', display: 'Auto Openings', appNames: ['AutoOpenings'], indices: ['logs-autoopenings-plugin'] },
  { name: 'Finishing', display: 'Finishing', appNames: ['Finishing'], indices: ['logs-finishing-plugin'] },
  { name: 'SharedCoordinates', display: 'Shared Coordinates', appNames: ['SharedCoordinates', 'Eneca.SharedCoordinates'], indices: ['logs-sharedcoordinates-plugin'] },
  { name: 'ProfiLay', display: 'Profi Lay', appNames: ['ProfiLay'], indices: ['logs-profilay-plugin'] },
  { name: 'LookupTables', display: 'Lookup Tables', appNames: ['LookupTables'], indices: ['logs-lookuptables-plugin'] },
  { name: 'ViewCloner', display: 'View Cloner', appNames: ['ViewCloner'], indices: ['logs-viewcloner-plugin', 'logs-viewcloner-server-plugin'] },
  { name: 'LintelsTransfer', display: 'Lintels Transfer', appNames: ['LintelsTransfer'], indices: ['logs-lintelstransfer-plugin'] },
  { name: 'SurfaceGen', display: 'Surface Gen', appNames: ['SurfaceGen'], indices: ['logs-surfacegen-plugin'] },
  { name: 'QuickMount', display: 'Quick Mount', appNames: ['QuickMount'], indices: ['logs-quickmount-plugin'] },
  { name: 'SchedulesTable', display: 'Schedules Table', appNames: ['SchedulesTable'], indices: ['logs-schedulestable-plugin'] },
  { name: 'SetToRevit', display: 'Set to Revit', appNames: ['SetToRevit'], indices: ['logs-settorevit-plugin'] },
  { name: 'ParkingSlots', display: 'Parking Slots', appNames: ['ParkingSlots'], indices: ['logs-parkingslots-plugin'] },
  { name: 'FilterAssistant', display: 'Filter Assistant', appNames: ['FilterAssistant'], indices: ['logs-filterassistant-plugin'] },
  { name: 'HVACAutoTag', display: 'HVAC Auto Tag', appNames: ['HVACAutoTag'], indices: ['logs-hvacautotag-plugin'] },
  { name: 'Evacuation', display: 'Evacuation', appNames: ['Evacuation'], indices: ['logs-evacuation-plugin'] },
  { name: 'RevitDataExporter', display: 'Revit Data Exporter', appNames: ['RevitDataExporter'], indices: ['logs-revitdataexporter-plugin'] },
  { name: 'EnecaFamilies', display: 'Eneca Families', appNames: ['EnecaFamilies.Frontend', 'EnecaFamilies.Backend'], indices: ['logs-enecafamilies-backend-plugin', 'logs-enecafamilies-frontend-plugin'] },
];

// Технические имена для отображения в UI (подсказки, списки)
export const PLUGIN_NAMES: string[] = PLUGINS.map((p) => p.name);

// Паттерны индексов ES, склеенные в строку для запроса
export const PLUGIN_INDICES: string = PLUGINS.flatMap((p) => p.indices).join(',');

// Маппинг Properties.AppName → читаемое название (ключи — точные значения из ES)
export const PLUGIN_DISPLAY_NAMES: Record<string, string> = Object.fromEntries(
  PLUGINS.flatMap((p) => p.appNames.map((appName) => [appName, p.display])),
);

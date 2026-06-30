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

export const PLUGINS: PluginDef[] = [
  { name: 'Auditor', display: 'Auditor', appNames: ['Auditor'], indices: ['auditor-*'] },
  { name: 'ClashesManager', display: 'Clashes Manager', appNames: ['ClashesManager.Revit'], indices: ['clashesmanager-*'] },
  { name: 'LinksManager', display: 'Links Manager', appNames: ['LinksManager'], indices: ['linksmanager-*'] },
  { name: 'ShareModel', display: 'Share Model', appNames: ['ShareModel'], indices: ['sharemodel-*'] },
  { name: 'SDT', display: 'Structural Design Toolkit', appNames: ['SDT'], indices: ['sdt-*'] },
  { name: 'ParamOperator', display: 'Param Operator', appNames: ['ParamOperator'], indices: ['paramoperator-*'] },
  { name: 'ApartmentLayouts', display: 'Apartment Layouts', appNames: ['ApartmentLayouts'], indices: ['apartmentlayouts-*'] },
  { name: 'FasciaCappings', display: 'Fascia Cappings', appNames: ['FasciaCappings'], indices: ['fasciacappings-*'] },
  { name: 'SpacesManager', display: 'Spaces Manager', appNames: ['SpacesManager'], indices: ['spacesmanager-*'] },
  { name: 'ResaveModels', display: 'ReSave', appNames: ['ResaveModels', 'ReSave Models'], indices: ['resavemodels-*'] },
  { name: 'AutoOpenings', display: 'Auto Openings', appNames: ['AutoOpenings'], indices: ['autoopenings-*'] },
  { name: 'Finishing', display: 'Finishing', appNames: ['Finishing'], indices: ['finishing-*'] },
  { name: 'SharedCoordinates', display: 'Shared Coordinates', appNames: ['SharedCoordinates', 'Eneca.SharedCoordinates'], indices: ['sharedcoordinates-*', 'eneca.sharedcoordinates-*'] },
  { name: 'ProfiLay', display: 'Profi Lay', appNames: ['ProfiLay'], indices: ['profilay-*'] },
  { name: 'LookupTables', display: 'Lookup Tables', appNames: ['LookupTables'], indices: ['lookuptables-*'] },
  { name: 'ViewCloner', display: 'View Cloner', appNames: ['ViewCloner'], indices: ['viewcloner-*'] },
  { name: 'LintelsTransfer', display: 'Lintels Transfer', appNames: ['LintelsTransfer'], indices: ['lintelstransfer-*'] },
  { name: 'SurfaceGen', display: 'Surface Gen', appNames: ['SurfaceGen'], indices: ['surfacegen-*'] },
  { name: 'QuickMount', display: 'Quick Mount', appNames: ['QuickMount'], indices: ['quickmount-*'] },
  { name: 'SchedulesTable', display: 'Schedules Table', appNames: ['SchedulesTable'], indices: ['schedulestable-*'] },
  { name: 'SetToRevit', display: 'Set to Revit', appNames: ['SetToRevit'], indices: ['settorevit-*'] },
  { name: 'ParkingSlots', display: 'Parking Slots', appNames: ['ParkingSlots'], indices: ['parkingslots-*'] },
  { name: 'FilterAssistant', display: 'Filter Assistant', appNames: ['FilterAssistant'], indices: ['filterassistant-*'] },
  { name: 'HVACAutoTag', display: 'HVAC Auto Tag', appNames: ['HVACAutoTag'], indices: ['hvacautotag-*'] },
  { name: 'Evacuation', display: 'Evacuation', appNames: ['Evacuation'], indices: ['evacuation-*'] },
  { name: 'RevitDataExporter', display: 'Revit Data Exporter', appNames: ['RevitDataExporter'], indices: ['revitdataexporter-*'] },
];

// Технические имена для отображения в UI (подсказки, списки)
export const PLUGIN_NAMES: string[] = PLUGINS.map((p) => p.name);

// Паттерны индексов ES, склеенные в строку для запроса
export const PLUGIN_INDICES: string = PLUGINS.flatMap((p) => p.indices).join(',');

// Маппинг Properties.AppName → читаемое название (ключи — точные значения из ES)
export const PLUGIN_DISPLAY_NAMES: Record<string, string> = Object.fromEntries(
  PLUGINS.flatMap((p) => p.appNames.map((appName) => [appName, p.display])),
);

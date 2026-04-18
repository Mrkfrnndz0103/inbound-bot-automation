const CONFIG = {
  spreadsheetId: 'YOUR_SPREADSHEET_ID',
  sheetName: 'bot_server',
  triggerCellA1: 'AD1',
  botTriggerUrl: 'https://your-bot-host.example.com/trigger',
  sharedSecret: 'change-me',
};

function watchSeatalkTriggerCell() {
  const sheet = SpreadsheetApp.openById(CONFIG.spreadsheetId).getSheetByName(CONFIG.sheetName);
  if (!sheet) {
    throw new Error(`Sheet not found: ${CONFIG.sheetName}`);
  }

  const currentValue = normalizeCellValue(sheet.getRange(CONFIG.triggerCellA1).getValue());
  const properties = PropertiesService.getScriptProperties();
  const propertyKey = buildPropertyKey();
  const previousValue = properties.getProperty(propertyKey);

  if (previousValue === null) {
    properties.setProperty(propertyKey, currentValue);
    Logger.log(`Baseline stored for ${CONFIG.sheetName}!${CONFIG.triggerCellA1}: ${currentValue}`);
    return;
  }

  if (currentValue === previousValue) {
    Logger.log(`No change in ${CONFIG.sheetName}!${CONFIG.triggerCellA1}: ${currentValue}`);
    return;
  }

  const payload = {
    trigger: 'apps_script_cell_change',
    source: 'google_apps_script',
    trigger_cell: CONFIG.triggerCellA1,
    previous_value: previousValue,
    current_value: currentValue,
    spreadsheet_id: CONFIG.spreadsheetId,
    tab_name: CONFIG.sheetName,
    fired_at: new Date().toISOString(),
    shared_secret: CONFIG.sharedSecret,
  };

  const response = UrlFetchApp.fetch(CONFIG.botTriggerUrl, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  const statusCode = response.getResponseCode();
  const responseBody = response.getContentText();
  if (statusCode < 200 || statusCode >= 300) {
    throw new Error(`Bot trigger failed with HTTP ${statusCode}: ${responseBody}`);
  }

  properties.setProperty(propertyKey, currentValue);
  Logger.log(`Change detected. Triggered bot for ${CONFIG.sheetName}!${CONFIG.triggerCellA1}.`);
}

function installMinuteTrigger() {
  deleteExistingWatchTriggers();
  ScriptApp.newTrigger('watchSeatalkTriggerCell')
    .timeBased()
    .everyMinutes(1)
    .create();
}

function deleteExistingWatchTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === 'watchSeatalkTriggerCell') {
      ScriptApp.deleteTrigger(trigger);
    }
  }
}

function resetSeatalkBaseline() {
  const sheet = SpreadsheetApp.openById(CONFIG.spreadsheetId).getSheetByName(CONFIG.sheetName);
  if (!sheet) {
    throw new Error(`Sheet not found: ${CONFIG.sheetName}`);
  }

  const currentValue = normalizeCellValue(sheet.getRange(CONFIG.triggerCellA1).getValue());
  PropertiesService.getScriptProperties().setProperty(buildPropertyKey(), currentValue);
  Logger.log(`Baseline reset for ${CONFIG.sheetName}!${CONFIG.triggerCellA1}: ${currentValue}`);
}

function buildPropertyKey() {
  return `seatalk_bot:${CONFIG.spreadsheetId}:${CONFIG.sheetName}:${CONFIG.triggerCellA1}`;
}

function normalizeCellValue(value) {
  if (value === null || value === '') {
    return '';
  }

  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ssXXX");
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return String(value).trim();
}

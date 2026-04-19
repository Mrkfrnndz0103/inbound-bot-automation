const CONFIG = {
  spreadsheetId: 'YOUR_SPREADSHEET_ID',
  sheetName: 'bot_server',
  triggerCellA1: 'AD1',
  botTriggerUrl: 'https://your-bot-host.example.com/trigger',
  sharedSecret: 'change-me',
  scheduleTimezone: 'Asia/Manila',
  scheduledSendTimes: ['12:00', '15:00', '18:00', '20:00', '22:00', '01:00', '03:00', '06:00'],
};

function runSeatalkChecks() {
  const sheet = getConfiguredSheet();
  const triggerState = getTriggerCellState(sheet);
  const properties = PropertiesService.getScriptProperties();
  const triggerPropertyKey = buildTriggerPropertyKey();
  const previousValue = properties.getProperty(triggerPropertyKey);

  if (previousValue === null) {
    properties.setProperty(triggerPropertyKey, triggerState.currentValue);
    Logger.log(
      `Baseline stored for ${CONFIG.sheetName}!${CONFIG.triggerCellA1}: ${triggerState.currentValue}`
    );
    sendScheduledUpdateIfDue(properties);
    return;
  }

  if (triggerState.currentValue !== previousValue) {
    postBotTrigger({
      trigger: 'apps_script_cell_change',
      source: 'google_apps_script',
      trigger_cell: CONFIG.triggerCellA1,
      previous_value: previousValue,
      current_value: triggerState.currentValue,
      spreadsheet_id: CONFIG.spreadsheetId,
      tab_name: CONFIG.sheetName,
      fired_at: new Date().toISOString(),
      shared_secret: CONFIG.sharedSecret,
    });

    properties.setProperty(triggerPropertyKey, triggerState.currentValue);
    Logger.log(`Change detected. Triggered bot for ${CONFIG.sheetName}!${CONFIG.triggerCellA1}.`);
    return;
  }

  Logger.log(`No change in ${CONFIG.sheetName}!${CONFIG.triggerCellA1}: ${triggerState.currentValue}`);
  sendScheduledUpdateIfDue(properties);
}

function watchSeatalkTriggerCell() {
  const sheet = getConfiguredSheet();
  const triggerState = getTriggerCellState(sheet);
  const properties = PropertiesService.getScriptProperties();
  const triggerPropertyKey = buildTriggerPropertyKey();
  const previousValue = properties.getProperty(triggerPropertyKey);

  if (previousValue === null) {
    properties.setProperty(triggerPropertyKey, triggerState.currentValue);
    Logger.log(
      `Baseline stored for ${CONFIG.sheetName}!${CONFIG.triggerCellA1}: ${triggerState.currentValue}`
    );
    return;
  }

  if (triggerState.currentValue === previousValue) {
    Logger.log(`No change in ${CONFIG.sheetName}!${CONFIG.triggerCellA1}: ${triggerState.currentValue}`);
    return;
  }

  postBotTrigger({
    trigger: 'apps_script_cell_change',
    source: 'google_apps_script',
    trigger_cell: CONFIG.triggerCellA1,
    previous_value: previousValue,
    current_value: triggerState.currentValue,
    spreadsheet_id: CONFIG.spreadsheetId,
    tab_name: CONFIG.sheetName,
    fired_at: new Date().toISOString(),
    shared_secret: CONFIG.sharedSecret,
  });

  properties.setProperty(triggerPropertyKey, triggerState.currentValue);
  Logger.log(`Change detected. Triggered bot for ${CONFIG.sheetName}!${CONFIG.triggerCellA1}.`);
}

function installMinuteTrigger() {
  deleteExistingWatchTriggers();
  ScriptApp.newTrigger('runSeatalkChecks')
    .timeBased()
    .everyMinutes(1)
    .create();
}

function deleteExistingWatchTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    if (
      trigger.getHandlerFunction() === 'watchSeatalkTriggerCell' ||
      trigger.getHandlerFunction() === 'runSeatalkChecks'
    ) {
      ScriptApp.deleteTrigger(trigger);
    }
  }
}

function resetSeatalkBaseline() {
  const sheet = getConfiguredSheet();
  const triggerState = getTriggerCellState(sheet);
  PropertiesService.getScriptProperties().setProperty(
    buildTriggerPropertyKey(),
    triggerState.currentValue
  );
  Logger.log(`Baseline reset for ${CONFIG.sheetName}!${CONFIG.triggerCellA1}: ${triggerState.currentValue}`);
}

function clearSeatalkScheduleState() {
  PropertiesService.getScriptProperties().deleteProperty(buildSchedulePropertyKey());
  Logger.log('Scheduled send state cleared.');
}

function getConfiguredSheet() {
  const sheet = SpreadsheetApp.openById(CONFIG.spreadsheetId).getSheetByName(CONFIG.sheetName);
  if (!sheet) {
    throw new Error(`Sheet not found: ${CONFIG.sheetName}`);
  }
  return sheet;
}

function getTriggerCellState(sheet) {
  return {
    currentValue: formatTriggerCellValue(sheet.getRange(CONFIG.triggerCellA1)),
  };
}

function sendScheduledUpdateIfDue(properties) {
  const timezone = CONFIG.scheduleTimezone || Session.getScriptTimeZone();
  const now = new Date();
  const currentTimeKey = Utilities.formatDate(now, timezone, 'HH:mm');
  if (CONFIG.scheduledSendTimes.indexOf(currentTimeKey) === -1) {
    return;
  }

  const schedulePropertyKey = buildSchedulePropertyKey();
  const scheduleSlotKey = Utilities.formatDate(now, timezone, 'yyyy-MM-dd HH:mm');
  if (properties.getProperty(schedulePropertyKey) === scheduleSlotKey) {
    Logger.log(`Scheduled send already completed for ${scheduleSlotKey} ${timezone}.`);
    return;
  }

  postBotTrigger({
    trigger: 'apps_script_schedule_send',
    source: 'google_apps_script_schedule',
    scheduled_time: Utilities.formatDate(now, timezone, 'h:mma'),
    schedule_timezone: timezone,
    spreadsheet_id: CONFIG.spreadsheetId,
    tab_name: CONFIG.sheetName,
    fired_at: now.toISOString(),
    shared_secret: CONFIG.sharedSecret,
  });

  properties.setProperty(schedulePropertyKey, scheduleSlotKey);
  Logger.log(`Scheduled send triggered for ${scheduleSlotKey} ${timezone}.`);
}

function postBotTrigger(payload) {
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
}

function buildTriggerPropertyKey() {
  return `seatalk_bot:${CONFIG.spreadsheetId}:${CONFIG.sheetName}:${CONFIG.triggerCellA1}`;
}

function buildSchedulePropertyKey() {
  return `seatalk_schedule:${CONFIG.spreadsheetId}:${CONFIG.sheetName}`;
}

function formatTriggerCellValue(range) {
  const value = range.getValue();
  const displayValue = String(range.getDisplayValue() || '').trim();

  if (value === null || value === '') {
    return '';
  }

  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'h:mma MMM-dd');
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    if (displayValue) {
      return displayValue;
    }
    return String(value);
  }

  if (displayValue) {
    return displayValue;
  }

  return String(value).trim();
}

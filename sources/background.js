function fetchLatestReportPromise(appId) {
  return new Promise(function(resolve, reject) {
    $ep.fetchLatestReportFor(
      appId,
      function(id, name, report) {
        resolve({ appID: id, name: name, report: report || null });
      },
      reject
    );
  });
}

function fetchTrackerListPromise() {
  return new Promise(function(resolve, reject) {
    $ep.fetchTrackerList(
      function(trackers) {
        resolve({ trackers: trackers });
      },
      reject
    );
  });
}

browser.runtime.onMessage.addListener(function(message, sender) {
  $ep.log('background:onMessage', { type: message.type });

  if (message.type === 'ep_fetchLatestReportFor') {
    return fetchLatestReportPromise(message.appID);
  }

  if (message.type === 'ep_fetchTrackerList') {
    return fetchTrackerListPromise();
  }

  var tabId = sender.tab.id;

  if (message.type === 't1') {
    var nb = message.nbTrackers;
    browser.action.setBadgeBackgroundColor({ color: '#224955' });

    if (nb === -1) {
      browser.action.setBadgeText({ text: '', tabId: tabId });
    } else if (nb === 0) {
      browser.action.setBadgeText({ text: '0', tabId: tabId });
    } else {
      browser.action.setBadgeText({ text: '' + nb, tabId: tabId });
    }
  } else if (message.type === 't4') {
    browser.action.setBadgeBackgroundColor({ color: '#224955' });

    if (message.nb === 0) {
      browser.action.setBadgeText({ text: '', tabId: tabId });
    } else {
      browser.action.setBadgeText({ text: '' + message.nb, tabId: tabId });
    }
  }
});

browser.tabs.onUpdated.addListener(function(tabId) {
  browser.action.setBadgeText({ text: '', tabId: tabId });
});

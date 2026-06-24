var browser = {
  runtime: {
    onMessage: chrome.runtime.onMessage
  },
  storage: {
    local: {
      get: function(keys) {
        return new Promise(function(resolve) {
          chrome.storage.local.get(keys, resolve);
        });
      },
      set: function(items) {
        return new Promise(function(resolve, reject) {
          chrome.storage.local.set(items, function() {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
          });
        });
      },
      remove: function(keys) {
        return new Promise(function(resolve, reject) {
          chrome.storage.local.remove(keys, function() {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
          });
        });
      }
    }
  }
};

importScripts('ep-api.js');

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

function sendAsyncResponse(promise, sendResponse) {
  promise.then(function(response) {
    sendResponse(response);
  }).catch(function(err) {
    sendResponse({ error: '' + err });
  });
  return true;
}

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  $ep.log('background:onMessage', { type: message.type });

  if (message.type === 'ep_fetchLatestReportFor') {
    return sendAsyncResponse(fetchLatestReportPromise(message.appID), sendResponse);
  }

  if (message.type === 'ep_fetchTrackerList') {
    return sendAsyncResponse(fetchTrackerListPromise(), sendResponse);
  }

  if (message.type === 't5') {
    if (!sender.tab) {
      return false;
    }

    var errorTabId = sender.tab.id;
    if (message.failed) {
      chrome.action.setBadgeBackgroundColor({ color: '#d93025' });
      chrome.action.setBadgeText({ text: '!', tabId: errorTabId });
    } else {
      chrome.action.setBadgeBackgroundColor({ color: '#224955' });
      chrome.action.setBadgeText({ text: '', tabId: errorTabId });
    }
    return false;
  }

  if (message.type === 't1') {
    if (!sender.tab) {
      return false;
    }

    var tabId = sender.tab.id;
    var nb = message.nbTrackers;
    chrome.action.setBadgeBackgroundColor({ color: '#224955' });

    if (nb === -1) {
      chrome.action.setBadgeText({ text: '', tabId: tabId });
    } else if (nb === 0) {
      chrome.action.setBadgeText({ text: '0', tabId: tabId });
    } else {
      chrome.action.setBadgeText({ text: '' + nb, tabId: tabId });
    }
  } else if (message.type === 't4') {
    if (!sender.tab) {
      return false;
    }

    var listingTabId = sender.tab.id;
    chrome.action.setBadgeBackgroundColor({ color: '#224955' });

    if (message.nb === 0) {
      chrome.action.setBadgeText({ text: '', tabId: listingTabId });
    } else {
      chrome.action.setBadgeText({ text: '' + message.nb, tabId: listingTabId });
    }
  }

  return false;
});

chrome.tabs.onUpdated.addListener(function(tabId) {
  chrome.action.setBadgeText({ text: '', tabId: tabId });
});

var $ep = {};
const DEBUG = false;
const authToken = "@@API_TOKEN";

$ep.debug = DEBUG;
$ep.knownCacheTtlMs = 7 * 24 * 60 * 60 * 1000;
$ep.unknownCacheTtlMs = 6 * 60 * 60 * 1000;
$ep.trackerListCacheTtlMs = 30 * 24 * 60 * 60 * 1000;
$ep.reportCache = {};
$ep.cacheLoaded = false;
$ep.cacheLoadPromise = null;
$ep.trackerListCache = null;
$ep.trackerListCacheLoaded = false;
$ep.trackerListCacheLoadPromise = null;

$ep.log = function() {
  if (!$ep.debug) {
    return;
  }
  var args = Array.prototype.slice.call(arguments);
  args.unshift('[Exodion]');
  console.log.apply(console, args);
};

$ep.error = function() {
  var args = Array.prototype.slice.call(arguments);
  args.unshift('[Exodion]');
  console.error.apply(console, args);
};

$ep.isPlayAppDetailsPage = function(url) {
  return !!(url && url.indexOf('://play.google.com/store/apps/details?id=') !== -1);
};

$ep.isPlayListingPage = function(url) {
  return !!(
    url &&
    (
      url.indexOf('://play.google.com/store/apps') !== -1 ||
      url.indexOf('://play.google.com/store/games') !== -1 ||
      url.indexOf('://play.google.com/store/search') !== -1 ||
      url.indexOf('://play.google.com/wishlist') !== -1
    ) &&
    !$ep.isPlayAppDetailsPage(url)
  );
};

$ep.isSupportedPlayPage = function(url) {
  return $ep.isPlayAppDetailsPage(url) || $ep.isPlayListingPage(url);
};

$ep.isBackgroundContext = function() {
  try {
    if (typeof window === 'undefined') {
      return true;
    }

    if (
      window.location &&
      (
        window.location.protocol === 'moz-extension:' ||
        window.location.protocol === 'chrome-extension:'
      )
    ) {
      return true;
    }
    return !!(
      browser &&
      browser.extension &&
      browser.extension.getBackgroundPage &&
      browser.extension.getBackgroundPage() === window
    );
  } catch (e) {
    return false;
  }
};

$ep.fetchJson = function(url, success, error) {
  $ep.log('fetchJson:start', { url: url });

  fetch(url, {
    method: 'GET',
    headers: {
      Authorization: authToken
    }
  })
    .then(function(response) {
      return response.text().then(function(text) {
        $ep.log('fetchJson:response', {
          url: url,
          status: response.status,
          ok: response.ok,
          sample: text.substring(0, 120)
        });

        if (!response.ok) {
          throw new Error('HTTP ' + response.status + ' for ' + url + ' - ' + text.substring(0, 200));
        }

        return text;
      });
    })
    .then(function(text) {
      success(JSON.parse(text));
    })
    .catch(function(err) {
      $ep.error('fetchJson:error', { url: url, error: '' + err });
      if (error) {
        error(err);
      }
    });
};

$ep.getCacheStorageKey = function() {
  return 'exodionReportCacheV1';
};

$ep.getTrackerListCacheStorageKey = function() {
  return 'exodionTrackerListCacheV1';
};

$ep.getCacheTTL = function(report) {
  return report ? $ep.knownCacheTtlMs : $ep.unknownCacheTtlMs;
};

$ep.loadReportCache = function() {
  if ($ep.cacheLoaded) {
    return Promise.resolve();
  }

  if ($ep.cacheLoadPromise) {
    return $ep.cacheLoadPromise;
  }

  $ep.cacheLoadPromise = browser.storage.local
    .get($ep.getCacheStorageKey())
    .then(function(data) {
      var cache = data[$ep.getCacheStorageKey()];
      $ep.reportCache = cache && typeof cache === 'object' ? cache : {};
      $ep.cacheLoaded = true;
    })
    .catch(function(err) {
      $ep.error('cache:load-failed', { error: '' + err });
      $ep.reportCache = {};
      $ep.cacheLoaded = true;
    });

  return $ep.cacheLoadPromise;
};

$ep.persistReportCache = function() {
  var payload = {};
  payload[$ep.getCacheStorageKey()] = $ep.reportCache;
  return browser.storage.local.set(payload).catch(function(err) {
    $ep.error('cache:save-failed', { error: '' + err });
  });
};

$ep.getCachedReport = function(appID) {
  var entry = $ep.reportCache[appID];
  if (!entry) {
    return null;
  }

  if (!entry.expiresAt || Date.now() > entry.expiresAt) {
    delete $ep.reportCache[appID];
    $ep.persistReportCache();
    return null;
  }

  return entry;
};

$ep.putCachedReport = function(appID, name, report) {
  $ep.reportCache[appID] = {
    appID: appID,
    name: name || null,
    report: report || null,
    expiresAt: Date.now() + $ep.getCacheTTL(report)
  };
  $ep.persistReportCache();
};

$ep.removeCachedReport = function(appID) {
  delete $ep.reportCache[appID];
  return $ep.persistReportCache();
};

$ep.clearReportCache = function() {
  $ep.reportCache = {};
  $ep.cacheLoaded = true;
  $ep.cacheLoadPromise = null;
  $ep.trackerListCache = null;
  $ep.trackerListCacheLoaded = true;
  $ep.trackerListCacheLoadPromise = null;
  return browser.storage.local.remove([
    $ep.getCacheStorageKey(),
    $ep.getTrackerListCacheStorageKey()
  ]).catch(function(err) {
    $ep.error('cache:clear-failed', { error: '' + err });
  });
};

$ep.fetchLatestReportFor = function(appID, success, error, meta) {
  if (!$ep.isBackgroundContext()) {
    $ep.log('fetchLatestReportFor:proxy', { appID: appID });
    browser.runtime
      .sendMessage({ type: 'ep_fetchLatestReportFor', appID: appID })
      .then(function(response) {
        if (response && response.error) {
          throw new Error(response.error);
        }

        $ep.log('fetchLatestReportFor:proxy-success', {
          appID: appID,
          hasReport: !!(response && response.report)
        });
        success(response.appID, response.name, response.report, meta);
      })
      .catch(function(err) {
        $ep.error('fetchLatestReportFor:proxy-error', { appID: appID, error: '' + err });
        if (error) {
          error(err);
        }
      });
    return;
  }

  $ep.fetchJson(
    'https://reports.exodus-privacy.eu.org/api/search/' + appID,
    function(json) {
      try {
        if (json[appID] && json[appID].reports) {
          var lastReport = getLatestReport(json[appID].reports);
          $ep.log('fetchLatestReportFor:success', {
            appID: appID,
            trackerCount: lastReport.trackers.length,
            reportId: lastReport.id
          });
          success(appID, json[appID].name, lastReport, meta);
        } else {
          $ep.log('fetchLatestReportFor:no-report', { appID: appID });
          success(appID, null, null, meta);
        }
      } catch (e) {
        $ep.error('fetchLatestReportFor:error', { appID: appID, error: '' + e });
        if (error) {
          error(e);
        }
      }
    },
    error
  );
};

$ep.fetchTrackerList = function(success, error) {
  if (!$ep.isBackgroundContext()) {
    browser.runtime
      .sendMessage({ type: 'ep_fetchTrackerList' })
      .then(function(response) {
        if (response && response.error) {
          throw new Error(response.error);
        }

        $ep.log('fetchTrackerList:proxy-success', {
          trackerCount: response && response.trackers ? Object.keys(response.trackers).length : 0
        });
        success(response.trackers);
      })
      .catch(function(err) {
        $ep.error('fetchTrackerList:proxy-error', { error: '' + err });
        if (error) {
          error(err);
        }
      });
    return;
  }

  $ep.loadTrackerListCache().then(function(cache) {
    if ($ep.isFreshTrackerListCache(cache)) {
      success(cache.trackers);
      return;
    }

    $ep.fetchJson(
      'https://reports.exodus-privacy.eu.org/api/trackers',
      function(json) {
        try {
          if (json.trackers) {
            $ep.putCachedTrackerList(json.trackers);
            success(json.trackers);
          } else if (cache && cache.trackers) {
            success(cache.trackers);
          } else if (error) {
            error('no trackers');
          }
        } catch (e) {
          if (cache && cache.trackers) {
            success(cache.trackers);
          } else if (error) {
            error(e);
          }
        }
      },
      function(err) {
        if (cache && cache.trackers) {
          success(cache.trackers);
        } else if (error) {
          error(err);
        }
      }
    );
  }).catch(function(err) {
    if (error) {
      error(err);
    }
  });
};

$ep.loadTrackerListCache = function() {
  if ($ep.trackerListCacheLoaded) {
    return Promise.resolve($ep.trackerListCache);
  }

  if ($ep.trackerListCacheLoadPromise) {
    return $ep.trackerListCacheLoadPromise;
  }

  $ep.trackerListCacheLoadPromise = browser.storage.local
    .get($ep.getTrackerListCacheStorageKey())
    .then(function(data) {
      var cache = data[$ep.getTrackerListCacheStorageKey()];
      $ep.trackerListCache = cache && cache.trackers ? cache : null;
      $ep.trackerListCacheLoaded = true;
      return $ep.trackerListCache;
    })
    .catch(function(err) {
      $ep.error('tracker-list-cache:load-failed', { error: '' + err });
      $ep.trackerListCache = null;
      $ep.trackerListCacheLoaded = true;
      return null;
    });

  return $ep.trackerListCacheLoadPromise;
};

$ep.isFreshTrackerListCache = function(cache) {
  return !!(
    cache &&
    cache.trackers &&
    cache.cachedAt &&
    Date.now() - cache.cachedAt < $ep.trackerListCacheTtlMs
  );
};

$ep.putCachedTrackerList = function(trackers) {
  $ep.trackerListCache = {
    trackers: trackers,
    cachedAt: Date.now()
  };
  $ep.trackerListCacheLoaded = true;

  var payload = {};
  payload[$ep.getTrackerListCacheStorageKey()] = $ep.trackerListCache;
  return browser.storage.local.set(payload).catch(function(err) {
    $ep.error('tracker-list-cache:save-failed', { error: '' + err });
  });
};

function getLatestReport(reports) {
  return reports.sort(function(a, b) {
    return b.version_code - a.version_code;
  })[0];
}

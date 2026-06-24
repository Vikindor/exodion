function setPopupVersion() {
  var versionEl = document.getElementById('popupVersion');
  if (!versionEl) {
    return;
  }

  versionEl.textContent = 'v' + browser.runtime.getManifest().version;
}

function getParameterByName(query, name) {
  var match = new RegExp('[?&]' + name + '=([^&]*)').exec(query);
  return match && decodeURIComponent(match[1].replace(/\+/g, ' '));
}

function getActiveWindowTabs() {
  return browser.tabs.query({ currentWindow: true, active: true });
}

function withActiveTab(callback) {
  return getActiveWindowTabs().then(function(tabs) {
    if (!tabs.length) {
      return null;
    }
    return callback(tabs[0]);
  });
}

function pulseButton(button, title) {
  if (!button) {
    return;
  }

  button.disabled = true;
  var originalTitle = button.title;
  var originalLabel = button.getAttribute('aria-label');
  button.title = title;
  button.setAttribute('aria-label', title);

  setTimeout(function() {
    button.disabled = false;
    button.title = originalTitle;
    button.setAttribute('aria-label', originalLabel);
  }, 900);
}

function setupHeaderActions() {
  var clearCacheButton = document.getElementById('clearCacheButton');
  var rescanPageButton = document.getElementById('rescanPageButton');

  if (clearCacheButton) {
    clearCacheButton.addEventListener('click', function() {
      $ep.clearReportCache().then(function() {
        return withActiveTab(function(tab) {
          return browser.tabs.sendMessage(tab.id, { type: 'exodion_clear_report_cache' }).catch(function() {
            return null;
          });
        });
      }).then(function() {
        pulseButton(clearCacheButton, 'Cache cleared');
      });
    });
  }

  if (rescanPageButton) {
    rescanPageButton.addEventListener('click', function() {
      withActiveTab(function(tab) {
        return browser.tabs.sendMessage(tab.id, { type: 'exodion_rescan_current_page' }).catch(function() {
          return null;
        });
      }).then(function() {
        pulseButton(rescanPageButton, 'Scan started');
      });
    });
  }
}

function removeLoader() {
  var els = document.querySelectorAll('.loader');
  for (var i = 0; i < els.length; i++) {
    els[i].parentNode.removeChild(els[i]);
  }
}

function renderEmptyState(title, text) {
  var container = document.getElementById('currentInfo');
  container.innerHTML = '';

  var info = document.createElement('p');
  info.className = 'trackerListTop';
  info.innerHTML = '<strong>' + title + '</strong><br>' + text;
  container.appendChild(info);
}

function renderConnectionProblem(status) {
  renderEmptyState(
    'Connection problem',
    'Exodion stopped automatic requests after ' +
      status.failures +
      ' failed attempts. Refresh the page or click the rescan button to try again.'
  );
}

function renderAppReport(appId, id, name, lastReport, trackers) {
  var zDiv = document.getElementById('currentInfo');
  zDiv.innerHTML = '';
  trackers = trackers || {};

  var infoP = document.createElement('p');
  var titleSpan = document.createElement('span');
  titleSpan.textContent = name || appId;
  titleSpan.className = 'appName';
  infoP.appendChild(titleSpan);

  var versionSpan = document.createElement('span');
  versionSpan.textContent = 'v' + lastReport.version;
  versionSpan.className = 'appVersion';
  infoP.appendChild(versionSpan);
  zDiv.appendChild(infoP);

  var trackerHead = document.createElement('p');
  trackerHead.className = 'trackerListTop';
  if (lastReport.trackers.length === 0) {
    trackerHead.textContent = 'The Exodus Privacy analysis did not found the code signature of any known trackers in this application.';
  } else if (lastReport.trackers.length === 1) {
    trackerHead.textContent = 'The Exodus Privacy analysis did found code signature of 1 tracker in this application.';
  } else {
    trackerHead.textContent = 'The Exodus Privacy analysis did found code signature of ' + lastReport.trackers.length + ' trackers in this application.';
  }
  zDiv.appendChild(trackerHead);

  var ul = document.createElement('ul');
  ul.className = 'trackerList';
  for (var i = 0; i < lastReport.trackers.length; i++) {
    var tracker = lastReport.trackers[i];
    var trackerInfo = trackers['' + tracker];
    ul.appendChild(
      domCreateTrackerLi(
        trackerInfo && trackerInfo.name ? trackerInfo.name : 'Tracker #' + tracker,
        'https://reports.exodus-privacy.eu.org/trackers/' + tracker + '/'
      )
    );
  }
  zDiv.appendChild(ul);

  var moreInfoA = document.createElement('a');
  moreInfoA.target = '_blank';
  moreInfoA.href = lastReport.id
    ? 'https://reports.exodus-privacy.eu.org/reports/' + lastReport.id + '/'
    : 'https://reports.exodus-privacy.eu.org/reports/search/' + id;
  moreInfoA.textContent = 'Get the full report on Exodus Privacy';
  zDiv.appendChild(moreInfoA);
  zDiv.appendChild(document.createElement('hr'));
}

function getPageAppName(tabId) {
  if (!tabId) {
    return Promise.resolve(null);
  }

  return browser.tabs.sendMessage(tabId, { type: 'exodion_get_page_app_name' }).then(function(response) {
    return response && response.name ? response.name : null;
  }).catch(function() {
    return null;
  });
}

function getPageFetchStatus(tabId) {
  if (!tabId) {
    return Promise.resolve(null);
  }

  return browser.tabs.sendMessage(tabId, { type: 'exodion_get_fetch_status' }).catch(function() {
    return null;
  });
}

function showAppReport(appId, cachedEntry, pageName) {
  var onReportReady = function(id, name, lastReport) {
    if (typeof name === 'undefined' || !lastReport) {
      removeLoader();
      renderEmptyState('No report yet', 'Exodus Privacy does not currently have a tracker report for this app.');
      return;
    }

    if (lastReport.trackers.length === 0) {
      removeLoader();
      renderAppReport(appId, id, pageName || name, lastReport, {});
      return;
    }

    $ep.fetchTrackerList(function(trackers) {
      removeLoader();
      renderAppReport(appId, id, pageName || name, lastReport, trackers);
    }, function(err) {
      removeLoader();
      renderAppReport(appId, id, pageName || name, lastReport, {});
      console.log(err);
    });
  };

  if (cachedEntry) {
    onReportReady(cachedEntry.appID, cachedEntry.name, cachedEntry.report);
    return;
  }

  $ep.fetchLatestReportFor(
    appId,
    function(id, name, lastReport) {
      $ep.putCachedReport(id, name, lastReport);
      onReportReady(id, name, lastReport);
    },
    function(err) {
      removeLoader();
      renderEmptyState('Report unavailable', 'Exodion could not fetch the Exodus Privacy report for this app right now.');
      console.log(err);
    }
  );
}

setPopupVersion();
setupHeaderActions();

$ep.loadReportCache().then(function() {
  return getActiveWindowTabs();
}).then(function(tabs) {
  document.getElementById('currentInfo').innerHTML = '';
  if (!tabs.length) {
    renderEmptyState('No active tab', 'Open Google Play in the current window to inspect apps and trackers.');
    return;
  }

  for (var tab of tabs) {
    if ($ep.isPlayAppDetailsPage(tab.url)) {
      var query = tab.url.substring(tab.url.indexOf('?'));
      var appId = getParameterByName(query, 'id');
      document.getElementById('currentInfo').innerHTML = '<div class="loader"></div>';
      getPageFetchStatus(tab.id).then(function(status) {
        if (status && status.blocked) {
          renderConnectionProblem(status);
          return null;
        }

        return getPageAppName(tab.id).then(function(pageName) {
          showAppReport(appId, $ep.getCachedReport(appId), pageName);
        });
      });
    } else if ($ep.isPlayListingPage(tab.url)) {
      document.getElementById('currentInfo').innerHTML = '<div class="loader"></div>';
      getPageFetchStatus(tab.id).then(function(status) {
        if (status && status.blocked) {
          renderConnectionProblem(status);
          return;
        }

        $ep.fetchTrackerList(function(trackers) {
          browser.tabs.sendMessage(tab.id, { type: 't3' }).then(function(infos) {
            createStatInfos(infos, trackers);
          }).catch(function() {
            removeLoader();
          });
        }, function(err) {
          removeLoader();
          console.log(err);
        });
      });
    } else {
      renderEmptyState('Google Play page not detected', 'Open an app page, search results, or a store listing on Google Play.');
    }
  }
});

function createStatInfos(infos, trackers) {
  var zDiv = document.getElementById('currentInfo');
  zDiv.innerHTML = '';
  setCurrentPanelTitle('Current page');
  if (infos.length === 0) {
    return;
  }

  var topHeader = document.createElement('p');
  topHeader.className = 'topStatInfo';
  topHeader.textContent = 'Information on Apps detected on this page.';
  zDiv.appendChild(topHeader);

  var scannedInfo = infos.filter(function(info) {
    return Array.isArray(info.trackers);
  });
  var analyzedInfo = scannedInfo.filter(function(info) {
    return info.trackers.length > 0;
  });
  var unanalyzedInfo = infos.filter(function(info) {
    return !Array.isArray(info.trackers);
  });
  var zeroTrackerInfo = scannedInfo.filter(function(info) {
    return info.trackers.length === 0;
  });

  zDiv.appendChild(createStatFactHtml(
    analyzedInfo.length,
    'App(s) with existing analysis',
    analyzedInfo,
    'Apps with existing analysis',
    'trackers',
    infos,
    trackers
  ));

  zDiv.appendChild(createStatFactHtml(
    zeroTrackerInfo.length,
    'App(s) with no trackers',
    zeroTrackerInfo,
    'Apps with no trackers',
    'zero',
    infos,
    trackers
  ));

  if (unanalyzedInfo.length > 0) {
    zDiv.appendChild(createStatFactHtml(
      unanalyzedInfo.length,
      'App(s) not yet analyzed',
      unanalyzedInfo,
      'Apps not yet analyzed',
      'unanalyzed',
      infos,
      trackers
    ));
  }

  var avTrackers = scannedInfo.map(function(info) {
    return info.trackers.length;
  }).reduce(function(a, b) {
    return a + b;
  }, 0) / (scannedInfo.length || 1);

  if (scannedInfo.length > 0) {
    zDiv.appendChild(createStatFactHtml(
      avTrackers.toFixed(1),
      'Average trackers per App',
      [],
      '',
      '',
      infos,
      trackers
    ));
  }

  var stats = {};
  for (var i = 0; i < scannedInfo.length; i++) {
    var ai = scannedInfo[i];
    for (var j = 0; j < ai.trackers.length; j++) {
      var ti = ai.trackers[j];
      stats['' + ti] = stats['' + ti] ? stats['' + ti] + 1 : 1;
    }
  }

  var statArr = [];
  for (var tid in stats) {
    var added = false;
    for (var k = 0; k < statArr.length; k++) {
      var cur = statArr[k];
      if (stats[tid] >= stats[cur]) {
        added = true;
        statArr.splice(k, 0, tid);
        break;
      }
    }
    if (!added) {
      statArr.push(tid);
    }
  }

  var trackerHead = document.createElement('p');
  trackerHead.className = 'trackerListTop';
  trackerHead.textContent = 'List of trackers sorted by presence:';
  zDiv.appendChild(trackerHead);

  var ul = document.createElement('ul');
  ul.className = 'trackerRatio';
  for (var m = 0; m < statArr.length; m++) {
    var tracker = statArr[m];
    var percent = (stats[tracker] / scannedInfo.length * 100).toFixed(0);
    var li = document.createElement('li');
    var appPluralSing = stats[tracker] > 1 ? ' apps)' : ' app)';
    li.appendChild(domCreateElement('span', 'trackerName', '' + percent + '% - ' + trackers['' + tracker].name + ' (in ' + stats[tracker] + appPluralSing));

    var link = domCreateElement('a', 'trackerWebLink', 'info');
    link.href = 'https://reports.exodus-privacy.eu.org/trackers/' + tracker + '/';
    link.target = '_blank';
    li.appendChild(link);

    ul.appendChild(li);
    li.className = 'p' + Math.floor(percent / 10);
  }
  zDiv.appendChild(ul);
}

function domCreateTrackerLi(trackerName, trackerURL) {
  var li = document.createElement('li');
  li.appendChild(domCreateElement('span', 'trackerName', trackerName));
  var link = domCreateElement('a', 'trackerWebLink', 'info');
  link.href = trackerURL;
  link.target = '_blank';
  li.appendChild(link);
  return li;
}

function domCreateElement(name, className, textContent) {
  var el = document.createElement(name);
  el.className = className;
  el.textContent = textContent;
  return el;
}

function setCurrentPanelTitle(title) {
  var titleEl = document.querySelector('.panel-main .panel-head h2');
  if (titleEl) {
    titleEl.textContent = title;
  }
}

function removeCategoryBackButton() {
  var existingButton = document.querySelector('.panel-main .panel-head .categoryBack');
  if (existingButton) {
    existingButton.remove();
  }
}

function renderAppCategory(title, items, mode, allInfos, trackers) {
  var zDiv = document.getElementById('currentInfo');
  zDiv.innerHTML = '';
  setCurrentPanelTitle(title);
  removeCategoryBackButton();

  var backButton = document.createElement('button');
  backButton.type = 'button';
  backButton.className = 'categoryBack';
  backButton.textContent = '←';
  backButton.setAttribute('aria-label', 'Back');
  backButton.title = 'Back';
  backButton.addEventListener('click', function() {
    removeCategoryBackButton();
    setCurrentPanelTitle('Current page');
    createStatInfos(allInfos, trackers);
  });
  document.querySelector('.panel-main .panel-head').prepend(backButton);

  var sortedItems = items.slice();
  sortedItems.sort(function(a, b) {
    if (mode === 'trackers-desc') {
      var trackerDifference = b.trackers.length - a.trackers.length;
      if (trackerDifference !== 0) {
        return trackerDifference;
      }
    }
    return a.id.localeCompare(b.id);
  });

  var list = document.createElement('ul');
  list.className = 'appCategoryList';
  if (sortedItems.length === 0) {
    var emptyItem = document.createElement('li');
    emptyItem.className = 'appCategoryEmpty';
    emptyItem.textContent = 'No apps in this category.';
    list.appendChild(emptyItem);
    zDiv.appendChild(list);
    return;
  }

  for (var i = 0; i < sortedItems.length; i++) {
    var info = sortedItems[i];
    var item = document.createElement('li');

    var link = document.createElement('a');
    link.className = 'appCategoryLink';
    link.href = 'https://play.google.com/store/apps/details?id=' + encodeURIComponent(info.id);
    link.target = '_blank';
    link.textContent = info.id;
    item.appendChild(link);

    var meta = document.createElement('span');
    meta.className = 'appCategoryMeta';
    if (mode === 'unanalyzed') {
      meta.textContent = 'No analysis';
    } else {
      var trackerCount = info.trackers.length;
      meta.textContent = trackerCount + (trackerCount === 1 ? ' tracker' : ' trackers');
    }
    item.appendChild(meta);
    list.appendChild(item);
  }
  zDiv.appendChild(list);
}

function createStatFactHtml(number, text, items, title, mode, allInfos, trackers) {
  var isCategoryLink = !!title;
  var p = document.createElement(isCategoryLink ? 'button' : 'p');
  p.className = isCategoryLink ? 'statLine statLineButton' : 'statLine';
  if (isCategoryLink) {
    p.type = 'button';
    p.addEventListener('click', function() {
      renderAppCategory(title, items, mode, allInfos, trackers);
    });
  }

  var spanL = document.createElement('span');
  spanL.textContent = '' + number;
  spanL.className = 'statNumber';
  p.appendChild(spanL);

  var spanR = document.createElement('span');
  spanR.textContent = text;
  spanR.className = 'statText';
  p.appendChild(spanR);

  return p;
}

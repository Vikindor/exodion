window._exodion = {
  shouldAppExodion: true,
  lastQ: window.location.href,
  fetchedAt: {},
  inFlight: {},
  fetchTtlMs: 5 * 60 * 1000,
  knownCacheTtlMs: 7 * 24 * 60 * 60 * 1000,
  unknownCacheTtlMs: 6 * 60 * 60 * 1000,
  reportCache: {},
  cacheLoaded: false,
  cacheLoadPromise: null
};

function xlog() {
  if (window.$ep && $ep.log) {
    $ep.log.apply($ep, arguments);
  }
}

function xerror() {
  if (window.$ep && $ep.error) {
    $ep.error.apply($ep, arguments);
  }
}

function getParameterByName(name) {
  var match = RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search);
  return match && decodeURIComponent(match[1].replace(/\+/g, ' '));
}

function createInfoElement(nbTrackers, appID, report) {
  var counterDiv = document.createElement('div');
  counterDiv.setAttribute('data-xodify', appID);

  var countSpan = document.createElement('span');
  countSpan.className = 'exodion-count';
  countSpan.textContent = nbTrackers + (nbTrackers === 1 ? ' tracker found' : ' trackers found');
  counterDiv.appendChild(countSpan);

  var actions = document.createElement('div');
  actions.className = 'exodion-actions';

  var poweredBySpan = document.createElement('a');
  poweredBySpan.className = 'exodion-powered';
  poweredBySpan.textContent = 'Open Exodus Privacy report';
  poweredBySpan.href = report && report.id
    ? 'https://reports.exodus-privacy.eu.org/reports/' + report.id + '/'
    : 'https://reports.exodus-privacy.eu.org/reports/search/' + appID;
  poweredBySpan.target = '_blank';
  actions.appendChild(poweredBySpan);

  actions.appendChild(createRefreshButton(appID));
  counterDiv.appendChild(actions);

  return counterDiv;
}

function createQuickInfoElement(nbTrackers, appID, reportID) {
  var counterDiv = document.createElement('div');
  counterDiv.id = 'exodion-' + appID;

  var linkWrap = document.createElement('a');
  linkWrap.target = '_blank';
  linkWrap.href = reportID
    ? 'https://reports.exodus-privacy.eu.org/reports/' + reportID + '/'
    : 'https://reports.exodus-privacy.eu.org/reports/search/' + appID;
  counterDiv.appendChild(linkWrap);

  var countSpan = document.createElement('p');
  countSpan.className = 'exodionquick-count';
  if (nbTrackers === -1) {
    countSpan.textContent = 'Unknown';
  } else if (nbTrackers === 1) {
    countSpan.textContent = '1 tracker';
  } else {
    countSpan.textContent = nbTrackers + ' trackers';
  }
  linkWrap.appendChild(countSpan);

  return counterDiv;
}

function createRefreshButton(appID) {
  var button = document.createElement('button');
  button.type = 'button';
  button.className = 'exodion-refresh';
  button.setAttribute('data-exodion-refresh', appID);
  button.setAttribute('aria-label', 'Refresh tracker report');
  button.title = 'Refresh tracker report';
  button.textContent = '↻';
  if (window._exodion.inFlight[appID]) {
    button.disabled = true;
    button.classList.add('is-loading');
  }
  return button;
}

function getCacheStorageKey() {
  return 'exodionReportCacheV1';
}

function getCacheTTL(report) {
  return report ? window._exodion.knownCacheTtlMs : window._exodion.unknownCacheTtlMs;
}

function loadReportCache() {
  if (window._exodion.cacheLoaded) {
    return Promise.resolve();
  }

  if (window._exodion.cacheLoadPromise) {
    return window._exodion.cacheLoadPromise;
  }

  window._exodion.cacheLoadPromise = browser.storage.local
    .get(getCacheStorageKey())
    .then(function(data) {
      var cache = data[getCacheStorageKey()];
      window._exodion.reportCache = cache && typeof cache === 'object' ? cache : {};
      window._exodion.cacheLoaded = true;
    })
    .catch(function(err) {
      xerror('cache:load-failed', { error: '' + err });
      window._exodion.reportCache = {};
      window._exodion.cacheLoaded = true;
    });

  return window._exodion.cacheLoadPromise;
}

function persistReportCache() {
  var payload = {};
  payload[getCacheStorageKey()] = window._exodion.reportCache;
  browser.storage.local.set(payload).catch(function(err) {
    xerror('cache:save-failed', { error: '' + err });
  });
}

function getCachedReport(appID) {
  var entry = window._exodion.reportCache[appID];
  if (!entry) {
    return null;
  }

  if (!entry.expiresAt || Date.now() > entry.expiresAt) {
    delete window._exodion.reportCache[appID];
    persistReportCache();
    return null;
  }

  return entry;
}

function putCachedReport(appID, name, report) {
  window._exodion.reportCache[appID] = {
    appID: appID,
    name: name || null,
    report: report || null,
    expiresAt: Date.now() + getCacheTTL(report)
  };
  persistReportCache();
}

function removeCachedReport(appID) {
  delete window._exodion.reportCache[appID];
  persistReportCache();
}

function renderQuickBadge(meta, id, name, report) {
  var existing = document.getElementById('exodion-' + id);
  if (existing) {
    existing.parentElement.removeChild(existing);
  }

  var nb = report ? report.trackers.length : -1;
  var reportID = report ? report.id : null;
  var counterDiv = createQuickInfoElement(nb, id, reportID);
  if (nb === -1) {
    counterDiv.className = 'exodion-quickbox mid';
  } else if (nb === 0) {
    counterDiv.className = 'exodion-quickbox clean';
  } else if (nb < 3) {
    counterDiv.className = 'exodion-quickbox mid';
  } else {
    counterDiv.className = 'exodion-quickbox';
  }
  counterDiv.setAttribute('data-ep-trackers', report ? JSON.stringify(report.trackers) : '');
  counterDiv.setAttribute('data-ep-appid', id);
  counterDiv.setAttribute('data-ep-name', name || '');

  var mount = getQuickBadgeMountElem(meta);
  mount.appendChild(counterDiv);
}

function extractAppIDFromHref(href) {
  if (!href) {
    return null;
  }

  try {
    var url = new URL(href, window.location.origin);
    if (url.pathname !== '/store/apps/details') {
      return null;
    }
    return url.searchParams.get('id');
  } catch (e) {
    return null;
  }
}

function createMissingElement(appID) {
  var counterDiv = document.createElement('div');
  counterDiv.setAttribute('data-xodify', appID);

  var countSpan = document.createElement('span');
  countSpan.className = 'exodion-count';
  countSpan.textContent = 'Tracker count unavailable';
  counterDiv.appendChild(countSpan);

  var actions = document.createElement('div');
  actions.className = 'exodion-actions';

  var poweredBySpan = document.createElement('a');
  poweredBySpan.className = 'exodion-powered';
  poweredBySpan.textContent = 'Request an Exodus Privacy analysis';
  poweredBySpan.href = 'https://reports.exodus-privacy.eu.org/analysis/submit/#' + appID;
  poweredBySpan.target = '_blank';
  actions.appendChild(poweredBySpan);

  actions.appendChild(createRefreshButton(appID));
  counterDiv.appendChild(actions);

  return counterDiv;
}

function createLoadingElement(appID, isRefreshing) {
  var counterDiv = document.createElement('div');
  counterDiv.setAttribute('data-xodify', appID);
  counterDiv.className = 'exodion-trackerInfoBoxLoading';

  var countSpan = document.createElement('span');
  countSpan.className = 'exodion-count';
  countSpan.textContent = isRefreshing ? 'Refreshing report...' : 'Fetching report...';
  counterDiv.appendChild(countSpan);

  var actions = document.createElement('div');
  actions.className = 'exodion-actions';

  var statusSpan = document.createElement('span');
  statusSpan.className = 'exodion-powered';
  statusSpan.textContent = 'Checking Exodus Privacy';
  actions.appendChild(statusSpan);

  actions.appendChild(createRefreshButton(appID));
  counterDiv.appendChild(actions);

  return counterDiv;
}

function createFetchErrorElement(appID) {
  var counterDiv = document.createElement('div');
  counterDiv.setAttribute('data-xodify', appID);
  counterDiv.className = 'exodion-trackerInfoBoxLoading error';

  var countSpan = document.createElement('span');
  countSpan.className = 'exodion-count';
  countSpan.textContent = 'Report fetch failed';
  counterDiv.appendChild(countSpan);

  var actions = document.createElement('div');
  actions.className = 'exodion-actions';

  var retrySpan = document.createElement('span');
  retrySpan.className = 'exodion-powered';
  retrySpan.textContent = 'Retry automatically or refresh now';
  actions.appendChild(retrySpan);

  actions.appendChild(createRefreshButton(appID));
  counterDiv.appendChild(actions);

  return counterDiv;
}

function mainAppBoxElem() {
  var eurist = document.querySelectorAll('div.cover-container')[0];
  if (eurist) {
    return eurist;
  }

  var candidates = document.querySelectorAll('div.oQ6oV');
  for (var i = 0; i < candidates.length; i++) {
    if (!candidates[i].offsetParent) {
      continue;
    }
    return candidates[i];
  }

  return document.querySelectorAll("c-wiz[jsdata='deferred-i8']")[0];
}

function getInstallAnchorElem() {
  var installButton = document.querySelector('button[aria-label="Install"]');
  if (!installButton) {
    return null;
  }

  var anchorElem = installButton;
  for (var i = 0; i < 7; i++) {
    if (!anchorElem.parentNode || anchorElem.parentNode.nodeType !== Node.ELEMENT_NODE) {
      return null;
    }
    anchorElem = anchorElem.parentNode;
  }

  return anchorElem;
}

function injectHtmlInAppContainer(elem) {
  var installAnchorElem = getInstallAnchorElem();
  if (installAnchorElem && installAnchorElem.parentNode) {
    xlog('injectHtmlInAppContainer:after-install-anchor', {
      anchorTag: installAnchorElem.tagName,
      anchorClass: installAnchorElem.className
    });
    installAnchorElem.parentNode.insertBefore(elem, installAnchorElem.nextSibling);
    return;
  }

  var targetElem = mainAppBoxElem();
  if (targetElem) {
    xlog('injectHtmlInAppContainer:before', {
      targetTag: targetElem.tagName,
      targetClass: targetElem.className,
      anchorTag: targetElem.tagName,
      anchorClass: targetElem.className
    });
    targetElem.parentNode.insertBefore(elem, targetElem);
  } else {
    xerror('injectHtmlInAppContainer:no-target');
  }
}

function findAlternativeEl() {
  if (!document.querySelectorAll) {
    return [];
  }

  function pushResult(results, ids, id, el, anchor) {
    if (!id || ids[id]) {
      return;
    }

    if (window.location.href.indexOf('/store/apps/details?id=' + id) !== -1) {
      return;
    }

    ids[id] = true;
    results.push({
      id: id,
      el: el,
      anchor: anchor
    });
  }

  var genericResults = [];
  var genericIds = {};
  var genericAnchors = document.querySelectorAll('a[href]');
  for (var i = 0; i < genericAnchors.length; i++) {
    var anchor = genericAnchors[i];
    var appID = extractAppIDFromHref(anchor.getAttribute('href'));
    if (!appID) {
      continue;
    }

    var cardHost = anchor.closest('[data-docid], [data-item-id], [role="listitem"], c-wiz') || anchor.parentNode;
    pushResult(genericResults, genericIds, appID, cardHost, anchor);
  }

  return genericResults;
}

function getQuickBadgeMountElem(meta) {
  var el = meta.el;
  var anchor = meta.anchor;
  var mount = el.querySelector('.cover');

  if (!mount && anchor) {
    mount = anchor.closest('[role="listitem"], [data-docid], [data-item-id]');
  }

  if (!mount && anchor && anchor.parentNode && anchor.parentNode.nodeType === Node.ELEMENT_NODE) {
    mount = anchor.parentNode;
  }

  if (!mount) {
    mount = el;
  }

  if (mount.classList) {
    mount.classList.add('exodion-badge-host');
  }

  return mount;
}

function shouldIgnoreXodify() {
  return window.location.href.indexOf('://play.google.com/apps') === -1 &&
    window.location.href.indexOf('://play.google.com/store/search') === -1 &&
    window.location.href.indexOf('://play.google.com/store/apps') === -1 &&
    window.location.href.indexOf('://play.google.com/store/games') === -1 &&
    window.location.href.indexOf('://play.google.com/wishlist') === -1;
}

function appXodify() {
  xlog('appXodify:start', { url: window.location.href, enabled: window._exodion.shouldAppExodion });
  if (!window._exodion.shouldAppExodion || shouldIgnoreXodify()) {
    return;
  }

  var alternatives = findAlternativeEl();
  xlog('appXodify:alternatives', { count: alternatives.length });
  if (alternatives.length === 0) {
    xerror('appXodify:no-alternatives-found', { url: window.location.href });
  }

  for (var i = 0; i < alternatives.length; i++) {
    var alternative = alternatives[i];
    var existing = document.getElementById('exodion-' + alternative.id);
    if (existing || window._exodion.inFlight[alternative.id]) {
      continue;
    }

    var cached = getCachedReport(alternative.id);
    if (cached) {
      renderQuickBadge(
        { el: alternative.el, anchor: alternative.anchor },
        cached.appID,
        cached.name,
        cached.report
      );
      continue;
    }

    if (
      window._exodion.fetchedAt[alternative.id] &&
      Date.now() - window._exodion.fetchedAt[alternative.id] < window._exodion.fetchTtlMs
    ) {
      continue;
    }

    window._exodion.inFlight[alternative.id] = true;
    $ep.fetchLatestReportFor(
      alternative.id,
      function(id, name, report, meta) {
        window._exodion.inFlight[id] = false;
        window._exodion.fetchedAt[id] = Date.now();
        putCachedReport(id, name, report);
        xlog('appXodify:repSuccess', { id: id, trackers: report ? report.trackers.length : -1 });

        if (window.location.href.indexOf('play.google.com/store/apps/details?id') !== -1) {
          return;
        }

        renderQuickBadge(meta, id, name, report);
        browser.runtime.sendMessage({ nb: document.querySelectorAll('.exodion-quickbox').length, type: 't4' });
      },
      function() {
        window._exodion.inFlight[alternative.id] = false;
        xerror('appXodify:fetch-failed', { id: alternative.id });
      },
      { el: alternative.el, anchor: alternative.anchor }
    );
  }
}

function getMainExodionBoxForAppID(id, fromEl) {
  var query = (fromEl || document).querySelectorAll("[data-xodify='" + id + "']");
  return query[0] || null;
}

function replaceMainExodionBox(appID, elem) {
  var existing = getMainExodionBoxForAppID(appID);
  if (existing) {
    existing.parentElement.removeChild(existing);
  }
  injectHtmlInAppContainer(elem);
}

function exodion(forceRefresh) {
  xlog('exodion:start', { url: window.location.href });
  if (window.location.href.indexOf('play.google.com/store/apps/details?') === -1) {
    return;
  }

  var appID = getParameterByName('id');
  xlog('exodion:appID', { appID: appID });
  if (!appID || window._exodion.inFlight[appID]) {
    return;
  }

  var cached = forceRefresh ? null : getCachedReport(appID);
  if (cached) {
    var cachedNb = cached.report ? cached.report.trackers.length : -1;
    browser.runtime.sendMessage({ appId: appID, nbTrackers: cachedNb, type: 't1' });
    if (cachedNb === -1) {
      var cachedMissingCounterDiv = createMissingElement(appID);
      cachedMissingCounterDiv.className = 'exodion-trackerInfoBoxClean missing';
      replaceMainExodionBox(appID, cachedMissingCounterDiv);
    } else {
      var cachedCounterDiv = createInfoElement(cachedNb, appID, cached.report);
      if (cachedNb === 0) {
        cachedCounterDiv.className = 'exodion-trackerInfoBoxClean';
      } else if (cachedNb < 3) {
        cachedCounterDiv.className = 'exodion-trackerInfoBoxMid';
      } else {
        cachedCounterDiv.className = 'exodion-trackerInfoBox';
      }
      replaceMainExodionBox(appID, cachedCounterDiv);
    }
    return;
  }

  var mainBox = mainAppBoxElem();
  xlog('exodion:mainBox', {
    found: !!mainBox,
    className: mainBox ? mainBox.className : null,
    tagName: mainBox ? mainBox.tagName : null
  });

  if (mainBox && getMainExodionBoxForAppID(appID, mainBox.parentNode)) {
    xlog('exodion:already-present', { appID: appID });
    return;
  }

  if (
    !forceRefresh &&
    window._exodion.fetchedAt[appID] &&
    Date.now() - window._exodion.fetchedAt[appID] < window._exodion.fetchTtlMs
  ) {
    return;
  }

  if (forceRefresh) {
    removeCachedReport(appID);
    delete window._exodion.fetchedAt[appID];
  }

  window._exodion.inFlight[appID] = true;
  replaceMainExodionBox(appID, createLoadingElement(appID, !!forceRefresh));
  $ep.fetchLatestReportFor(
    appID,
    function(id, name, report) {
      window._exodion.inFlight[id] = false;
      window._exodion.fetchedAt[id] = Date.now();
      putCachedReport(id, name, report);
      var nb = report ? report.trackers.length : -1;
      xlog('exodion:fetch-success', { id: id, trackers: nb, reportId: report ? report.id : null });

      browser.runtime.sendMessage({ appId: id, nbTrackers: nb, type: 't1' });
      if (nb === -1) {
        var missingCounterDiv = createMissingElement(appID);
        missingCounterDiv.className = 'exodion-trackerInfoBoxClean missing';
        replaceMainExodionBox(appID, missingCounterDiv);
      } else {
        var counterDiv = createInfoElement(nb, id, report);
        if (nb === 0) {
          counterDiv.className = 'exodion-trackerInfoBoxClean';
        } else if (nb < 3) {
          counterDiv.className = 'exodion-trackerInfoBoxMid';
        } else {
          counterDiv.className = 'exodion-trackerInfoBox';
        }
        replaceMainExodionBox(appID, counterDiv);
      }

      var alternatives = findAlternativeEl();
      for (var i = 0; i < alternatives.length; i++) {
        var alternative = alternatives[i];
        if (
          window._exodion.inFlight[alternative.id] ||
          (
            window._exodion.fetchedAt[alternative.id] &&
            Date.now() - window._exodion.fetchedAt[alternative.id] < window._exodion.fetchTtlMs
          )
        ) {
          continue;
        }

        window._exodion.inFlight[alternative.id] = true;
        $ep.fetchLatestReportFor(
          alternative.id,
          function(altId, altName, altReport, meta) {
            window._exodion.inFlight[altId] = false;
            window._exodion.fetchedAt[altId] = Date.now();
            putCachedReport(altId, altName, altReport);
            renderQuickBadge(meta, altId, altName, altReport);
          },
          function() {
            window._exodion.inFlight[alternative.id] = false;
          },
          { el: alternative.el, anchor: alternative.anchor }
        );
      }
    },
    function() {
      window._exodion.inFlight[appID] = false;
      replaceMainExodionBox(appID, createFetchErrorElement(appID));
      xerror('exodion:main-fetch-failed', { appID: appID });
    }
  );
}

window.addEventListener('error', function(event) {
  xerror('window-error', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno
  });
});

xlog('content-script-loaded', { url: window.location.href });
loadReportCache().then(function() {
  exodion();
  appXodify();
});

setInterval(function() {
  if (!window._exodion.cacheLoaded) {
    return;
  }

  if (window._exodion.lastQ !== window.location.href) {
    browser.runtime.sendMessage({ nb: 0, type: 't4' });
    window._exodion.lastQ = window.location.href;
    exodion();
    appXodify();
    return;
  }

  if (window.location.href.indexOf('play.google.com/store/apps/details?') !== -1) {
    if (!getMainExodionBoxForAppID(getParameterByName('id'))) {
      exodion();
    }
  } else {
    appXodify();
  }
}, 15000);

browser.runtime.onMessage.addListener(function(message) {
  if (message.type === 't3') {
    var quickBoxes = document.querySelectorAll('.exodion-quickbox');
    var metaDatas = [];
    for (var i = 0; i < quickBoxes.length; i++) {
      var qb = quickBoxes[i];
      var trackers = qb.getAttribute('data-ep-trackers');
      metaDatas.push({
        id: qb.getAttribute('data-ep-appid'),
        trackers: trackers ? JSON.parse(trackers) : null,
        name: qb.getAttribute('data-ep-name')
      });
    }
    return new Promise(function(resolve) {
      resolve(metaDatas);
    });
  }
});

document.addEventListener('click', function(event) {
  var refreshButton = event.target.closest('[data-exodion-refresh]');
  if (!refreshButton) {
    return;
  }

  event.preventDefault();

  var appID = refreshButton.getAttribute('data-exodion-refresh');
  if (!appID || appID !== getParameterByName('id')) {
    return;
  }

  exodion(true);
});

window._exodion = {
  shouldAppExodion: true,
  lastQ: window.location.href,
  fetchedAt: {},
  inFlight: {},
  fetchTtlMs: 5 * 60 * 1000,
  observer: null,
  appExodionTimer: null,
  maxConcurrentBadgeFetches: 6,
  activeBadgeFetches: 0,
  hostSeq: 0,
  listingInteractionListenerAttached: false,
  appExodionFollowUpTimer: null
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
  counterDiv.setAttribute('data-exodion', appID);

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
  counterDiv.setAttribute('data-exodion-badge-for', appID);

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

function applyQuickBadgeState(counterDiv, nbTrackers, appID, reportID, name, report) {
  counterDiv.setAttribute('data-exodion-badge-for', appID);
  counterDiv.setAttribute('data-ep-trackers', report ? JSON.stringify(report.trackers) : '');
  counterDiv.setAttribute('data-ep-appid', appID);
  counterDiv.setAttribute('data-ep-name', name || '');

  if (nbTrackers === -1) {
    counterDiv.className = 'exodion-quickbox mid';
  } else if (nbTrackers === 0) {
    counterDiv.className = 'exodion-quickbox clean';
  } else if (nbTrackers < 3) {
    counterDiv.className = 'exodion-quickbox mid';
  } else {
    counterDiv.className = 'exodion-quickbox';
  }

  var linkWrap = counterDiv.querySelector('a');
  if (!linkWrap) {
    linkWrap = document.createElement('a');
    linkWrap.target = '_blank';
    counterDiv.appendChild(linkWrap);
  }

  linkWrap.target = '_blank';
  linkWrap.href = reportID
    ? 'https://reports.exodus-privacy.eu.org/reports/' + reportID + '/'
    : 'https://reports.exodus-privacy.eu.org/reports/search/' + appID;

  var countSpan = linkWrap.querySelector('.exodionquick-count');
  if (!countSpan) {
    countSpan = document.createElement('p');
    countSpan.className = 'exodionquick-count';
    linkWrap.appendChild(countSpan);
  }

  if (nbTrackers === -1) {
    countSpan.textContent = 'Unknown';
  } else if (nbTrackers === 1) {
    countSpan.textContent = '1 tracker';
  } else {
    countSpan.textContent = nbTrackers + ' trackers';
  }
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

function renderQuickBadge(meta, id, name, report) {
  var scope = getQuickBadgeScope(meta);
  var mount = getQuickBadgeMountElem(meta);
  var existing = getExistingQuickBadge(scope || mount, id);

  var nb = report ? report.trackers.length : -1;
  var reportID = report ? report.id : null;
  var counterDiv = existing || createQuickInfoElement(nb, id, reportID);
  applyQuickBadgeState(counterDiv, nb, id, reportID, name, report);

  if (!existing) {
    mount.appendChild(counterDiv);
  }
}

function getExistingQuickBadge(mount, appID) {
  if (!mount || !mount.querySelector) {
    return null;
  }

  return mount.querySelector('.exodion-quickbox[data-exodion-badge-for="' + appID + '"]');
}

function getAnyQuickBadgeForAppID(appID) {
  return document.querySelector('.exodion-quickbox[data-exodion-badge-for="' + appID + '"]');
}

function getQuickBadgeScope(meta) {
  var el = meta && meta.el;
  var anchor = meta && meta.anchor;

  if (anchor) {
    return anchor.closest('[role="listitem"]') ||
      anchor.closest('[data-docid]') ||
      anchor.closest('[data-item-id]') ||
      anchor.closest('c-wiz');
  }

  if (el && el.closest) {
    return el.closest('[role="listitem"], [data-docid], [data-item-id], c-wiz');
  }

  return null;
}

function buildCurrentPageStatInfos() {
  var alternatives = findAlternativeEl();
  var byAppID = {};
  var infos = [];

  for (var i = 0; i < alternatives.length; i++) {
    var alternative = alternatives[i];
    if (!alternative.id || byAppID[alternative.id]) {
      continue;
    }

    byAppID[alternative.id] = true;
    var cached = $ep.getCachedReport(alternative.id);
    if (cached) {
      infos.push({
        id: cached.appID,
        trackers: cached.report ? cached.report.trackers : null
      });
      continue;
    }

    var scope = getQuickBadgeScope({ el: alternative.el, anchor: alternative.anchor });
    var mount = getQuickBadgeMountElem({ el: alternative.el, anchor: alternative.anchor });
    var quickBadge = getExistingQuickBadge(scope || mount, alternative.id) || getAnyQuickBadgeForAppID(alternative.id);
    var trackers = quickBadge ? quickBadge.getAttribute('data-ep-trackers') : null;

    infos.push({
      id: alternative.id,
      trackers: trackers ? JSON.parse(trackers) : null
    });
  }

  return infos;
}

function countScannedCurrentPageApps() {
  var infos = buildCurrentPageStatInfos();
  var count = 0;

  for (var i = 0; i < infos.length; i++) {
    if (Array.isArray(infos[i].trackers)) {
      count += 1;
    }
  }

  return count;
}

function updateListingActionBadge() {
  browser.runtime.sendMessage({
    nb: countScannedCurrentPageApps(),
    type: 't4'
  });
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
  counterDiv.setAttribute('data-exodion', appID);

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
  counterDiv.setAttribute('data-exodion', appID);
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
  counterDiv.setAttribute('data-exodion', appID);
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

  function isVisibleCardHost(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) {
      return false;
    }

    if (el.getClientRects && el.getClientRects().length === 0) {
      return false;
    }

    var style = window.getComputedStyle ? window.getComputedStyle(el) : null;
    if (style && (style.display === 'none' || style.visibility === 'hidden')) {
      return false;
    }

    return true;
  }

  function getHostKey(el) {
    if (!el || !el.dataset) {
      return null;
    }

    if (!el.dataset.exodionHostKey) {
      window._exodion.hostSeq += 1;
      el.dataset.exodionHostKey = 'h' + window._exodion.hostSeq;
    }

    return el.dataset.exodionHostKey;
  }

  function pushResult(results, seen, id, el, anchor) {
    if (!id || !isVisibleCardHost(el)) {
      return;
    }

    if (window.location.href.indexOf('/store/apps/details?id=' + id) !== -1) {
      return;
    }

    var hostKey = getHostKey(el);
    if (!hostKey) {
      return;
    }

    var resultKey = id + '::' + hostKey;
    if (seen[resultKey]) {
      return;
    }

    seen[resultKey] = true;
    results.push({
      id: id,
      el: el,
      anchor: anchor
    });
  }

  function getCardHost(anchor) {
    var listItem = anchor.closest('[role="listitem"]');
    if (listItem) {
      var node = anchor;
      while (node && node.parentElement && node.parentElement !== listItem) {
        node = node.parentElement;
      }

      if (node && node.parentElement === listItem) {
        return node;
      }

      return listItem.firstElementChild || listItem;
    }

    return anchor.closest('[role="listitem"]') ||
      anchor.closest('[data-docid]') ||
      anchor.closest('[data-item-id]') ||
      anchor.closest('c-wiz') ||
      anchor.parentNode;
  }

  var genericResults = [];
  var genericSeen = {};
  var genericAnchors = document.querySelectorAll('a[href]');
  for (var i = 0; i < genericAnchors.length; i++) {
    var anchor = genericAnchors[i];
    var appID = extractAppIDFromHref(anchor.getAttribute('href'));
    if (!appID) {
      continue;
    }

    var cardHost = getCardHost(anchor);
    pushResult(genericResults, genericSeen, appID, cardHost, anchor);
  }

  return genericResults;
}

function getQuickBadgeMountElem(meta) {
  var el = meta.el;
  var anchor = meta.anchor;
  var mount = null;

  if (el && el.parentElement && el.parentElement.getAttribute && el.parentElement.getAttribute('role') === 'listitem') {
    mount = el;
  }

  if (!mount && el && el.getAttribute && el.getAttribute('role') === 'listitem') {
    mount = el.firstElementChild;
  }

  if (!mount && el && el.querySelector) {
    mount = el.querySelector('.cover');
  }

  if (!mount && anchor) {
    var listItem = anchor.closest('[role="listitem"]');
    if (listItem) {
      var node = anchor;
      while (node && node.parentElement && node.parentElement !== listItem) {
        node = node.parentElement;
      }

      if (node && node.parentElement === listItem) {
        mount = node;
      } else {
        mount = listItem.firstElementChild || listItem;
      }
    }
  }

  if (!mount && anchor) {
    mount = anchor.closest('[data-docid]') ||
      anchor.closest('[data-item-id]');
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

function appExodion() {
  xlog('appExodion:start', { url: window.location.href, enabled: window._exodion.shouldAppExodion });
  if (!window._exodion.shouldAppExodion || !$ep.isSupportedPlayPage(window.location.href)) {
    return;
  }

  var alternatives = findAlternativeEl();
  xlog('appExodion:alternatives', { count: alternatives.length });
  if (alternatives.length === 0) {
    xerror('appExodion:no-alternatives-found', { url: window.location.href });
  }

  for (var i = 0; i < alternatives.length; i++) {
    var alternative = alternatives[i];
    var scope = getQuickBadgeScope({ el: alternative.el, anchor: alternative.anchor });
    var mount = getQuickBadgeMountElem({ el: alternative.el, anchor: alternative.anchor });
    var existing = getExistingQuickBadge(scope || mount, alternative.id);
    if (existing || window._exodion.inFlight[alternative.id]) {
      continue;
    }

    var cached = $ep.getCachedReport(alternative.id);
    if (cached) {
      renderQuickBadge(
        { el: alternative.el, anchor: alternative.anchor },
        cached.appID,
        cached.name,
        cached.report
      );
      updateListingActionBadge();
      continue;
    }

    if (
      window._exodion.fetchedAt[alternative.id] &&
      Date.now() - window._exodion.fetchedAt[alternative.id] < window._exodion.fetchTtlMs
    ) {
      continue;
    }

    if (window._exodion.activeBadgeFetches >= window._exodion.maxConcurrentBadgeFetches) {
      continue;
    }

    window._exodion.activeBadgeFetches += 1;
    window._exodion.inFlight[alternative.id] = true;
    $ep.fetchLatestReportFor(
      alternative.id,
      function(id, name, report, meta) {
        window._exodion.inFlight[id] = false;
        window._exodion.activeBadgeFetches = Math.max(0, window._exodion.activeBadgeFetches - 1);
        window._exodion.fetchedAt[id] = Date.now();
        $ep.putCachedReport(id, name, report);
        xlog('appExodion:repSuccess', { id: id, trackers: report ? report.trackers.length : -1 });

        if ($ep.isPlayAppDetailsPage(window.location.href)) {
          scheduleAppExodion(0);
          return;
        }

        renderQuickBadge(meta, id, name, report);
        updateListingActionBadge();
        scheduleAppExodion(0);
      },
      function() {
        window._exodion.inFlight[alternative.id] = false;
        window._exodion.activeBadgeFetches = Math.max(0, window._exodion.activeBadgeFetches - 1);
        xerror('appExodion:fetch-failed', { id: alternative.id });
        scheduleAppExodion(1000);
      },
      { el: alternative.el, anchor: alternative.anchor }
    );
  }
}

function scheduleAppExodion(delayMs) {
  if (window._exodion.appExodionTimer) {
    clearTimeout(window._exodion.appExodionTimer);
  }

  window._exodion.appExodionTimer = setTimeout(function() {
    window._exodion.appExodionTimer = null;
    appExodion();
  }, typeof delayMs === 'number' ? delayMs : 150);
}

function scheduleAppExodionFollowUp(delayMs) {
  if (window._exodion.appExodionFollowUpTimer) {
    clearTimeout(window._exodion.appExodionFollowUpTimer);
  }

  window._exodion.appExodionFollowUpTimer = setTimeout(function() {
    window._exodion.appExodionFollowUpTimer = null;
    scheduleAppExodion(0);
  }, typeof delayMs === 'number' ? delayMs : 1200);
}

function startAppExodionObserver() {
  if (window._exodion.observer || !document.body || !$ep.isSupportedPlayPage(window.location.href)) {
    return;
  }

  window._exodion.observer = new MutationObserver(function(mutations) {
    for (var i = 0; i < mutations.length; i++) {
      if (mutations[i].removedNodes && mutations[i].removedNodes.length > 0) {
        var removedBadge = false;
        for (var k = 0; k < mutations[i].removedNodes.length; k++) {
          var removedNode = mutations[i].removedNodes[k];
          if (
            removedNode.nodeType === Node.ELEMENT_NODE &&
            (
              (removedNode.classList && removedNode.classList.contains('exodion-quickbox')) ||
              (removedNode.querySelector && removedNode.querySelector('.exodion-quickbox'))
            )
          ) {
            removedBadge = true;
            break;
          }
        }

        if (removedBadge) {
          scheduleAppExodion(150);
          return;
        }
      }

      if (mutations[i].addedNodes && mutations[i].addedNodes.length > 0) {
        var hasExternalNodes = false;
        for (var j = 0; j < mutations[i].addedNodes.length; j++) {
          var addedNode = mutations[i].addedNodes[j];
          if (
            addedNode.nodeType === Node.ELEMENT_NODE &&
            addedNode.classList &&
            addedNode.classList.contains('exodion-quickbox')
          ) {
            continue;
          }

          hasExternalNodes = true;
          break;
        }

        if (!hasExternalNodes) {
          continue;
        }

        scheduleAppExodion(150);
        return;
      }
    }
  });

  window._exodion.observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  window.addEventListener('scroll', function() {
    scheduleAppExodion(150);
  }, { passive: true });

  document.addEventListener('scroll', function() {
    scheduleAppExodion(150);
  }, { passive: true, capture: true });

  if (!window._exodion.listingInteractionListenerAttached) {
    document.addEventListener('click', function(event) {
      if (
        !$ep.isSupportedPlayPage(window.location.href) ||
        $ep.isPlayAppDetailsPage(window.location.href)
      ) {
        return;
      }

      var carouselButton = event.target.closest('button[aria-label="Scroll Previous"], button[aria-label="Scroll Next"]');
      if (!carouselButton) {
        return;
      }

      scheduleAppExodion(350);
      scheduleAppExodionFollowUp(1200);
    }, true);

    window._exodion.listingInteractionListenerAttached = true;
  }
}

function getMainExodionBoxForAppID(id, fromEl) {
  var query = (fromEl || document).querySelectorAll("[data-exodion='" + id + "']");
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
  if (!$ep.isPlayAppDetailsPage(window.location.href)) {
    return;
  }

  var appID = getParameterByName('id');
  xlog('exodion:appID', { appID: appID });
  if (!appID || window._exodion.inFlight[appID]) {
    return;
  }

  var cached = forceRefresh ? null : $ep.getCachedReport(appID);
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
    $ep.removeCachedReport(appID);
    delete window._exodion.fetchedAt[appID];
  }

  window._exodion.inFlight[appID] = true;
  replaceMainExodionBox(appID, createLoadingElement(appID, !!forceRefresh));
  $ep.fetchLatestReportFor(
    appID,
    function(id, name, report) {
      window._exodion.inFlight[id] = false;
      window._exodion.fetchedAt[id] = Date.now();
      $ep.putCachedReport(id, name, report);
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
            $ep.putCachedReport(altId, altName, altReport);
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
$ep.loadReportCache().then(function() {
  exodion();
  appExodion();
  startAppExodionObserver();
});

setInterval(function() {
  if (!$ep.cacheLoaded) {
    return;
  }

  if (window._exodion.lastQ !== window.location.href) {
    browser.runtime.sendMessage({ nb: 0, type: 't4' });
    window._exodion.lastQ = window.location.href;
    exodion();
    appExodion();
    startAppExodionObserver();
    return;
  }

  if ($ep.isPlayAppDetailsPage(window.location.href)) {
    if (!getMainExodionBoxForAppID(getParameterByName('id'))) {
      exodion();
    }
  } else {
    appExodion();
  }
}, 15000);

browser.runtime.onMessage.addListener(function(message) {
  if (message.type === 't3') {
    return new Promise(function(resolve) {
      resolve(buildCurrentPageStatInfos());
    });
  }

  if (message.type === 'exodion_rescan_current_page') {
    if ($ep.isPlayAppDetailsPage(window.location.href)) {
      exodion(true);
    } else if ($ep.isPlayListingPage(window.location.href)) {
      window._exodion.inFlight = {};
      window._exodion.activeBadgeFetches = 0;
      scheduleAppExodion(0);
      scheduleAppExodionFollowUp(900);
    }
    return Promise.resolve({ ok: true });
  }

  if (message.type === 'exodion_clear_report_cache') {
    return $ep.clearReportCache().then(function() {
      return { ok: true };
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

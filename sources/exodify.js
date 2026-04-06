window._exodify = {
  shouldAppExodify: false,
  lastQ: window.location.href,
  fetchedAt: {},
  inFlight: {},
  fetchTtlMs: 5 * 60 * 1000
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
  countSpan.className = 'exodify-count';
  countSpan.textContent = nbTrackers + (nbTrackers <= 1 ? ' Tracker  ' : ' Trackers  ');
  counterDiv.appendChild(countSpan);

  var poweredBySpan = document.createElement('a');
  poweredBySpan.className = 'exodify-powered';
  poweredBySpan.textContent = 'powered by ExodusPrivacy';
  poweredBySpan.href = report && report.id
    ? 'https://reports.exodus-privacy.eu.org/reports/' + report.id + '/'
    : 'https://reports.exodus-privacy.eu.org/reports/search/' + appID;
  poweredBySpan.target = '_blank';
  counterDiv.appendChild(poweredBySpan);

  return counterDiv;
}

function createQuickInfoElement(nbTrackers, appID, reportID) {
  var counterDiv = document.createElement('div');
  counterDiv.id = 'exodify-' + appID;

  var linkWrap = document.createElement('a');
  linkWrap.target = '_blank';
  if (reportID) {
    linkWrap.href = 'https://reports.exodus-privacy.eu.org/reports/' + reportID + '/';
  }
  counterDiv.appendChild(linkWrap);

  var countSpan = document.createElement('p');
  countSpan.className = 'exodifyquick-count';
  if (nbTrackers === -1) {
    countSpan.textContent = 'Unknown';
  } else if (nbTrackers <= 1) {
    countSpan.textContent = nbTrackers + ' Tracker';
  } else {
    countSpan.textContent = nbTrackers + ' Trackers';
  }
  linkWrap.appendChild(countSpan);

  return counterDiv;
}

function createMissingElement(appID) {
  var counterDiv = document.createElement('div');
  counterDiv.setAttribute('data-xodify', appID);

  var countSpan = document.createElement('span');
  countSpan.className = 'exodify-count';
  countSpan.textContent = 'Number of trackers unknown ';
  counterDiv.appendChild(countSpan);

  var poweredBySpan = document.createElement('a');
  poweredBySpan.className = 'exodify-powered';
  poweredBySpan.textContent = 'Would you like to let ExodusPrivacy analyze it?';
  poweredBySpan.href = 'https://reports.exodus-privacy.eu.org/analysis/submit/#' + appID;
  poweredBySpan.target = '_blank';
  counterDiv.appendChild(poweredBySpan);

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

function injectHtmlInAppContainer(elem) {
  var targetElem = mainAppBoxElem();
  if (targetElem) {
    xlog('injectHtmlInAppContainer:before', {
      targetTag: targetElem.tagName,
      targetClass: targetElem.className
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

  var els = document.querySelectorAll('div.card-content[data-docid]');
  if (els.length > 0) {
    var results = [];
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var anchors = el.querySelectorAll("a[href^='/store/apps/details?id=']");
      if (anchors.length > 0) {
        results.push({ id: el.getAttribute('data-docid'), el: el });
      }
    }
    return results;
  }

  els = document.querySelectorAll("a.AnjTGd[href^='/store/apps/details?id=']");
  if (els.length > 0) {
    var anjResults = [];
    for (var j = 0; j < els.length; j++) {
      var anjEl = els[j];
      anjResults.push({
        id: anjEl.getAttribute('href').substring('/store/apps/details?id='.length),
        el: anjEl.parentNode
      });
    }
    return anjResults;
  }

  els = document.querySelectorAll("a.poRVub[href^='/store/apps/details?id=']");
  if (els.length > 0) {
    var poResults = [];
    for (var k = 0; k < els.length; k++) {
      var poEl = els[k];
      poResults.push({
        id: poEl.getAttribute('href').substring('/store/apps/details?id='.length),
        el: poEl.parentNode
      });
    }
    return poResults;
  }

  els = document.querySelectorAll("a.card-click-target[href^='/store/apps/details?id=']");
  if (els.length > 0) {
    var cardResults = [];
    for (var m = 0; m < els.length; m++) {
      var cardEl = els[m];
      cardResults.push({
        id: cardEl.getAttribute('href').substring('/store/apps/details?id='.length),
        el: cardEl.parentNode
      });
    }
    return cardResults;
  }

  return [];
}

function shouldIgnoreXodify() {
  return window.location.href.indexOf('://play.google.com/apps') === -1 &&
    window.location.href.indexOf('://play.google.com/store/search') === -1 &&
    window.location.href.indexOf('://play.google.com/store/apps') === -1 &&
    window.location.href.indexOf('://play.google.com/wishlist') === -1;
}

function appXodify() {
  xlog('appXodify:start', { url: window.location.href, enabled: window._exodify.shouldAppExodify });
  if (!window._exodify.shouldAppExodify || shouldIgnoreXodify()) {
    return;
  }

  var alternatives = findAlternativeEl();
  xlog('appXodify:alternatives', { count: alternatives.length });

  for (var i = 0; i < alternatives.length; i++) {
    var alternative = alternatives[i];
    var existing = document.getElementById('exodify-' + alternative.id);
    if (existing || window._exodify.inFlight[alternative.id]) {
      continue;
    }
    if (
      window._exodify.fetchedAt[alternative.id] &&
      Date.now() - window._exodify.fetchedAt[alternative.id] < window._exodify.fetchTtlMs
    ) {
      continue;
    }

    window._exodify.inFlight[alternative.id] = true;
    $ep.fetchLatestReportFor(
      alternative.id,
      function(id, name, report, meta) {
        window._exodify.inFlight[id] = false;
        window._exodify.fetchedAt[id] = Date.now();
        xlog('appXodify:repSuccess', { id: id, trackers: report ? report.trackers.length : -1 });

        if (window.location.href.indexOf('play.google.com/store/apps/details?id') !== -1) {
          return;
        }

        var nb = report ? report.trackers.length : -1;
        var el = meta.el;
        var reportID = report ? report.id : null;
        var counterDiv = createQuickInfoElement(nb, id, reportID);
        if (nb === -1) {
          counterDiv.className = 'exodify-quickbox mid';
        } else if (nb === 0) {
          counterDiv.className = 'exodify-quickbox clean';
        } else if (nb < 3) {
          counterDiv.className = 'exodify-quickbox mid';
        } else {
          counterDiv.className = 'exodify-quickbox';
        }
        counterDiv.setAttribute('data-ep-trackers', report ? JSON.stringify(report.trackers) : '');
        counterDiv.setAttribute('data-ep-appid', id);
        counterDiv.setAttribute('data-ep-name', name);
        var rEL = el.querySelectorAll('.cover')[0] || el;
        rEL.appendChild(counterDiv);
        browser.runtime.sendMessage({ nb: document.querySelectorAll('.exodify-quickbox').length, type: 't4' });
      },
      function() {
        window._exodify.inFlight[alternative.id] = false;
        xerror('appXodify:fetch-failed', { id: alternative.id });
      },
      { el: alternative.el }
    );
  }
}

function getMainExodifyBoxForAppID(id, fromEl) {
  var query = (fromEl || document).querySelectorAll("[data-xodify='" + id + "']");
  return query[0] || null;
}

function exodify() {
  xlog('exodify:start', { url: window.location.href });
  if (window.location.href.indexOf('play.google.com/store/apps/details?') === -1) {
    return;
  }

  var appID = getParameterByName('id');
  xlog('exodify:appID', { appID: appID });
  if (!appID || window._exodify.inFlight[appID]) {
    return;
  }

  var mainBox = mainAppBoxElem();
  xlog('exodify:mainBox', {
    found: !!mainBox,
    className: mainBox ? mainBox.className : null,
    tagName: mainBox ? mainBox.tagName : null
  });

  if (mainBox && getMainExodifyBoxForAppID(appID, mainBox.parentNode)) {
    xlog('exodify:already-present', { appID: appID });
    return;
  }

  if (
    window._exodify.fetchedAt[appID] &&
    Date.now() - window._exodify.fetchedAt[appID] < window._exodify.fetchTtlMs
  ) {
    return;
  }

  window._exodify.inFlight[appID] = true;
  $ep.fetchLatestReportFor(
    appID,
    function(id, name, report) {
      window._exodify.inFlight[id] = false;
      window._exodify.fetchedAt[id] = Date.now();
      var nb = report ? report.trackers.length : -1;
      xlog('exodify:fetch-success', { id: id, trackers: nb, reportId: report ? report.id : null });

      var existing = getMainExodifyBoxForAppID(id);
      if (existing) {
        existing.parentElement.removeChild(existing);
      }

      browser.runtime.sendMessage({ appId: id, nbTrackers: nb, type: 't1' });
      if (nb === -1) {
        var missingCounterDiv = createMissingElement(appID);
        missingCounterDiv.className = 'exodify-trackerInfoBoxClean missing';
        injectHtmlInAppContainer(missingCounterDiv);
      } else {
        var counterDiv = createInfoElement(nb, id, report);
        if (nb === 0) {
          counterDiv.className = 'exodify-trackerInfoBoxClean';
        } else if (nb < 3) {
          counterDiv.className = 'exodify-trackerInfoBoxMid';
        } else {
          counterDiv.className = 'exodify-trackerInfoBox';
        }
        injectHtmlInAppContainer(counterDiv);
      }

      var alternatives = findAlternativeEl();
      for (var i = 0; i < alternatives.length; i++) {
        var alternative = alternatives[i];
        if (
          window._exodify.inFlight[alternative.id] ||
          (
            window._exodify.fetchedAt[alternative.id] &&
            Date.now() - window._exodify.fetchedAt[alternative.id] < window._exodify.fetchTtlMs
          )
        ) {
          continue;
        }

        window._exodify.inFlight[alternative.id] = true;
        $ep.fetchLatestReportFor(
          alternative.id,
          function(altId, altName, altReport, meta) {
            window._exodify.inFlight[altId] = false;
            window._exodify.fetchedAt[altId] = Date.now();
            var altNb = altReport ? altReport.trackers.length : -1;
            var el = meta.el;
            var reportID = altReport ? altReport.id : null;
            var existingAlt = document.getElementById('exodify-' + altId);
            if (existingAlt) {
              existingAlt.parentElement.removeChild(existingAlt);
            }

            var altCounterDiv = createQuickInfoElement(altNb, altId, reportID);
            if (altNb === -1) {
              altCounterDiv.className = 'exodify-quickbox mid';
            } else if (altNb === 0) {
              altCounterDiv.className = 'exodify-quickbox clean';
            } else if (altNb < 3) {
              altCounterDiv.className = 'exodify-quickbox mid';
            } else {
              altCounterDiv.className = 'exodify-quickbox';
            }

            var rEL = el.querySelectorAll('.cover')[0] || el;
            rEL.appendChild(altCounterDiv);
          },
          function() {
            window._exodify.inFlight[alternative.id] = false;
          },
          { el: alternative.el }
        );
      }
    },
    function() {
      window._exodify.inFlight[appID] = false;
      xerror('exodify:main-fetch-failed', { appID: appID });
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
exodify();
appXodify();

setInterval(function() {
  if (window._exodify.lastQ !== window.location.href) {
    browser.runtime.sendMessage({ nb: 0, type: 't4' });
    window._exodify.lastQ = window.location.href;
    exodify();
    appXodify();
    return;
  }

  if (window.location.href.indexOf('play.google.com/store/apps/details?') !== -1) {
    if (!getMainExodifyBoxForAppID(getParameterByName('id'))) {
      exodify();
    }
  } else {
    appXodify();
  }
}, 15000);

browser.runtime.onMessage.addListener(function(message) {
  if (message.type === 't3') {
    var quickBoxes = document.querySelectorAll('.exodify-quickbox');
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

function onError() {}

function onGot(item) {
  if (typeof item.extendedExodify !== 'undefined') {
    if (typeof item.extendedExodify === 'boolean') {
      window._exodify.shouldAppExodify = item.extendedExodify;
    } else {
      window._exodify.shouldAppExodify = item.extendedExodify.newValue;
    }
  } else {
    window._exodify.shouldAppExodify = true;
  }
}

browser.storage.local.get('extendedExodify').then(onGot, onError);
browser.storage.onChanged.addListener(onGot);

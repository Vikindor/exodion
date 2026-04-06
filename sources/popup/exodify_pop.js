const button = document.getElementById('test');
button.addEventListener('click', function() {
  browser.runtime.openOptionsPage();
});

function getParameterByName(query, name) {
  var match = new RegExp('[?&]' + name + '=([^&]*)').exec(query);
  return match && decodeURIComponent(match[1].replace(/\+/g, ' '));
}

function getActiveWindowTabs() {
  return browser.tabs.query({ currentWindow: true, active: true });
}

function removeLoader() {
  var els = document.querySelectorAll('.loader');
  for (var i = 0; i < els.length; i++) {
    els[i].parentNode.removeChild(els[i]);
  }
}

getActiveWindowTabs().then(function(tabs) {
  document.getElementById('currentInfo').innerHTML = '';
  for (var tab of tabs) {
    if (tab.url && tab.url.indexOf('://play.google.com/store/apps/details?id=') !== -1) {
      var query = tab.url.substring(tab.url.indexOf('?'));
      var appId = getParameterByName(query, 'id');
      document.getElementById('currentInfo').innerHTML = '<div class="loader"></div>';
      $ep.fetchLatestReportFor(appId, function(id, name, lastReport) {
        if (typeof name !== 'undefined' && lastReport) {
          $ep.fetchTrackerList(function(trackers) {
            removeLoader();
            var zDiv = document.getElementById('currentInfo');
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
              try {
                ul.appendChild(
                  domCreateTrackerLi(
                    trackers['' + tracker].name,
                    'https://reports.exodus-privacy.eu.org/trackers/' + tracker + '/'
                  )
                );
              } catch (e) {
                var li = document.createElement('li');
                li.textContent = trackers['' + tracker].name;
                ul.appendChild(li);
              }
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
          }, function(err) {
            console.log(err);
          });
        } else {
          removeLoader();
        }
      });
    } else if (
      tab.url &&
      (
        tab.url.indexOf('://play.google.com/apps') !== -1 ||
        tab.url.indexOf('://play.google.com/store/search') !== -1 ||
        tab.url.indexOf('://play.google.com/store/apps') !== -1
      )
    ) {
      browser.tabs.sendMessage(tab.id, { type: 't3' });
      document.getElementById('currentInfo').innerHTML = '<div class="loader"></div>';
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
    }
  }
});

function createStatInfos(infos, trackers) {
  var zDiv = document.getElementById('currentInfo');
  zDiv.innerHTML = '';
  if (infos.length === 0) {
    return;
  }

  var topHeader = document.createElement('p');
  topHeader.className = 'topStatInfo';
  topHeader.textContent = 'Information on Apps detected on this page.';
  zDiv.appendChild(topHeader);

  var analyzedInfo = infos.filter(function(info) {
    return Array.isArray(info.trackers);
  });
  zDiv.appendChild(createStatFactHtml(analyzedInfo.length, 'App(s) with existing analysis.'));

  if (infos.length - analyzedInfo.length > 0) {
    zDiv.appendChild(createStatFactHtml(infos.length - analyzedInfo.length, 'App(s) not yet analyzed.'));
  }

  var avTrackers = analyzedInfo.map(function(info) {
    return info.trackers.length;
  }).reduce(function(a, b) {
    return a + b;
  }, 0) / analyzedInfo.length;

  if (avTrackers) {
    zDiv.appendChild(createStatFactHtml(avTrackers.toFixed(1), 'average trackers per App.'));
  }

  var withZero = analyzedInfo.filter(function(info) {
    return info.trackers.length === 0;
  }).length;
  zDiv.appendChild(createStatFactHtml(withZero, 'App(s) with no trackers.'));

  var stats = {};
  for (var i = 0; i < analyzedInfo.length; i++) {
    var ai = analyzedInfo[i];
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
    var percent = (stats[tracker] / analyzedInfo.length * 100).toFixed(0);
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

function createStatFactHtml(number, text) {
  var p = document.createElement('p');
  p.className = 'statLine';

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

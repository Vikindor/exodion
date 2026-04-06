function saveOptions(event) {
  event.preventDefault();
  browser.storage.local.set({
    extendedExodion: document.querySelector('#extendedExodion').checked
  });
}

function restoreOptions() {
  function setCurrentChoice(result) {
    document.querySelector('#extendedExodion').checked =
      typeof result.extendedExodion === 'undefined' ? true : result.extendedExodion;
  }

  function onError() {}

  browser.storage.local.get('extendedExodion').then(setCurrentChoice, onError);
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.querySelector('#extendedExodion').addEventListener('change', saveOptions);

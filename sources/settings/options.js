function saveOptions(event) {
  event.preventDefault();
  browser.storage.local.set({
    extendedExodify: document.querySelector('#extendedExodify').checked
  });
}

function restoreOptions() {
  function setCurrentChoice(result) {
    document.querySelector('#extendedExodify').checked =
      typeof result.extendedExodify === 'undefined' ? true : result.extendedExodify;
  }

  function onError() {}

  browser.storage.local.get('extendedExodify').then(setCurrentChoice, onError);
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.querySelector('#extendedExodify').addEventListener('change', saveOptions);

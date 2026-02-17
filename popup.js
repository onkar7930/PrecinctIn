document.addEventListener('DOMContentLoaded', function() {
  const toggle = document.getElementById('enabledToggle');
  const keywordsTextarea = document.getElementById('keywords');
  const saveBtn = document.getElementById('saveBtn');

  // Load saved settings
  chrome.storage.sync.get(['enabled', 'keywords'], function(data) {
    toggle.checked = data.enabled || false;
    keywordsTextarea.value = data.keywords || '';
  });

  // Save settings on button click
  saveBtn.addEventListener('click', function() {
    const enabled = toggle.checked;
    const keywords = keywordsTextarea.value;
    
    chrome.storage.sync.set({
      enabled: enabled,
      keywords: keywords
    }, function() {
      // Notify content script
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs[0] && tabs[0].url && tabs[0].url.includes('linkedin.com')) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: "updateSettings",
            enabled: enabled,
            keywords: keywords
          });
        }
      });
      window.close(); // Close popup after save
    });
  });

  // Also handle toggle change immediately if preferred, but for now stick to button save.
});

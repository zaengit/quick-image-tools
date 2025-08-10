chrome.runtime.onInstalled.addListener(() => {
    chrome.sidePanel.setOptions({
        path: 'sidepanel.html',
        enabled: true
    });
});
  
chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.open({ tabId: tab.id });
});
  
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
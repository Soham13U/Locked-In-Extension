chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type === "CLOSE_TAB") {
    const tabId = sender?.tab?.id;
    if (typeof tabId === "number") chrome.tabs.remove(tabId);
  }
});

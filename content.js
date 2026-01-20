const SNOOZE_MIN = 0.5;

function nowMS()
{
  return Date.now();
}

async function getSnoozeMap()
{
    const data = await chrome.storage.local.get(["snoozeUntil"]);
    return data.snoozeUntil ?? {};
}
function getHostKey() {
  return location.hostname.toLowerCase();
}

async function setSnooze(host,untilMS)
{
    const map = await getSnoozeMap();
    map[host] = untilMS;
    await chrome.storage.local.set({snoozeUntil: map});
}

async function isSnoozed(host) {
  const map = await getSnoozeMap();
  const until = map[host];
  return typeof until === "number" && until > nowMS();
}

function disableScroll(disable)
{
  const html = document.documentElement;
  const body = document.body; //can be null at document_start

   if (disable) {
    // store previous overflow values safely
    html.dataset.__focusOverlayScrollHtml = html.style.overflow || "";
    html.style.overflow = "hidden";

    if (body) {
      body.dataset.__focusOverlayScrollBody = body.style.overflow || "";
      body.style.overflow = "hidden";
    }
  } else {
    html.style.overflow = html.dataset.__focusOverlayScrollHtml ?? "";
    delete html.dataset.__focusOverlayScrollHtml;

    if (body) {
      body.style.overflow = body.dataset.__focusOverlayScrollBody ?? "";
      delete body.dataset.__focusOverlayScrollBody;
    }
  }

}

const init =  function(){

    const existing = document.getElementById("focus-overlay-root");
    if(existing) return;



    const root = document.createElement("div");
    const host = getHostKey();
    const pausedByOverlay = new Set();
    let pauseEnforcerId = null;

    root.id = "focus-overlay-root";
    root.style.position = "fixed";
    root.style.inset = "0";
    root.style.zIndex = "2147483647";
    root.style.pointerEvents = "auto";

    const IMG_POOL = ["images/1.jpg","images/2.jpg","images/3.jpg"];

    function pickRandomImage()
    {
      const choice = IMG_POOL[Math.floor(Math.random() * IMG_POOL.length)];
      return chrome.runtime.getURL(choice);
    }

    const imgURL = pickRandomImage();

    function getCandidateVideos()
    {
      return Array.from(document.querySelectorAll("video"));
    }

    function isPlaying(video)
    {
      return ( video && !video.paused && !video.ended && video.readyState > 2);
    }

   function disableVideo(disable) {
  const videos = getCandidateVideos();

  if (disable) {
    pausedByOverlay.clear();

    for (const v of videos) {
      if (!v) continue;

      // Pause only if it's playing now
      if (!v.paused && !v.ended) {
        try {
          v.pause();
          pausedByOverlay.add(v);
        } catch (e) {
          // ignore: some videos may throw due to site restrictions
        }
      }
    }
  } else {
    // Resume only the ones we paused
    for (const v of pausedByOverlay) {
      try {
        // Only resume if it's still paused (and element still exists)
        if (v && v.isConnected && v.paused) v.play();
      } catch (e) {
        // ignore: play() can fail if site blocks or user gesture required
      }
    }
    pausedByOverlay.clear();
  }

  console.log("videos found:", videos.length, videos.map(v => ({paused: v.paused, readyState: v.readyState, currentTime: v.currentTime})));


    }



    function pauseAllVideosOnce() {
  const videos = getCandidateVideos();
  for (const v of videos) {
    if (!v) continue;
    if (!v.paused && !v.ended) {
      try {
        v.pause();
        pausedByOverlay.add(v);
      } catch {}
    }
  }
}

function startPauseEnforcer() {
  if (pauseEnforcerId !== null) return; // already running
  pauseEnforcerId = window.setInterval(() => {
    // stop if overlay no longer exists
    if (!document.getElementById("focus-overlay-root")) {
      stopPauseEnforcer();
      return;
    }
    pauseAllVideosOnce();
  }, 250);
}

function stopPauseEnforcer() {
  if (pauseEnforcerId !== null) {
    clearInterval(pauseEnforcerId);
    pauseEnforcerId = null;
  }
}


   


 

  root.innerHTML = `
    <style>
      
      .backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.72);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        box-sizing: border-box;
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
      }
      .card {
        width: min(920px, 100%);
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.14);
        border-radius: 20px;
        overflow: hidden;
        box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        display: grid;
        grid-template-columns: 1.2fr 1fr;
      }
      @media (max-width: 800px) {
        .card { grid-template-columns: 1fr; }
      }
      .left {
        min-height: 360px;
        background: #111;
        position: relative;
      }
      .left img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
        filter: saturate(1.05) contrast(1.05);
      }
      .left::after {
        content: "";
        position: absolute;
        inset: 0;
        background: linear-gradient(90deg, rgba(0,0,0,0.25), rgba(0,0,0,0.65));
      }
      .right {
        padding: 22px 22px 18px;
        color: rgba(255,255,255,0.92);
        display: flex;
        flex-direction: column;
        gap: 12px;
        background: rgba(15,15,15,0.55);
        backdrop-filter: blur(10px);
      }
      .kicker {
        font-size: 12px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: rgba(255,255,255,0.65);
      }
      .title {
        font-size: 28px;
        line-height: 1.15;
        margin: 0;
      }
      .desc {
        font-size: 14px;
        line-height: 1.5;
        color: rgba(255,255,255,0.72);
        margin: 0;
      }
      .pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.16);
        background: rgba(255,255,255,0.06);
        width: fit-content;
        font-size: 13px;
        color: rgba(255,255,255,0.75);
      }
      .actions {
        margin-top: 6px;
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }
      button {
        border: 1px solid rgba(255,255,255,0.18);
        background: rgba(255,255,255,0.08);
        color: rgba(255,255,255,0.9);
        padding: 10px 12px;
        border-radius: 12px;
        font-weight: 600;
        cursor: pointer;
        font-size: 14px;
      }
      button:hover { background: rgba(255,255,255,0.12); }
      .primary {
        background: rgba(255,255,255,0.16);
      }
      .danger {
        border-color: rgba(255,80,80,0.35);
        background: rgba(255,80,80,0.12);
      }
      .danger:hover { background: rgba(255,80,80,0.18); }
      .footer {
        margin-top: auto;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        font-size: 12px;
        color: rgba(255,255,255,0.55);
      }
      a { color: rgba(255,255,255,0.75); text-decoration: underline; }
    </style>

    <div class="backdrop" role="dialog" aria-modal="true">
      <div class="card">
        <div class="left">
          <img src="${imgURL}" alt="Image"/>
        </div>
        <div class="right">
          <div class="kicker">Focus Check</div>
          <h1 class="title">You opened ${host} <span style="opacity:.85"></span></h1>
          <p class="desc">If this is intentional, you can continue. If not, close the tab and return to your main task.</p>
       

          <div class="actions">
            <button class="primary" id="dismissBtn">Continue anyway</button>
            <button id="snoozeBtn">Snooze ${SNOOZE_MIN}  min</button>
            <button class="danger" id="closeBtn">Close tab</button>
          </div>

          <div class="footer">
            <span>Overlay shows every visit.</span>
            <span>Press <b>Esc</b> to dismiss.</span>
          </div>
        </div>
      </div>
    </div>
  `;

  
  document.documentElement.append(root);
  disableScroll(true);
  disableVideo(true);
  startPauseEnforcer();
  



const dismissBtn = root.querySelector("#dismissBtn");   
const snoozeBtn = root.querySelector("#snoozeBtn");
const closeBtn = root.querySelector("#closeBtn");



function remove()
{
  disableScroll(false);
  stopPauseEnforcer();
  disableVideo(false);
  root.remove();
  window.removeEventListener("keydown", onKeyDown, true);
}

function onKeyDown(e)
{
  if(e.key === "Escape") remove();
}

async function onSnooze()
{
  const until = nowMS() + SNOOZE_MIN*60*1000;
  await setSnooze(host,until);
  remove();
}

function onCloseTab()
{
  chrome.runtime.sendMessage({type: "CLOSE_TAB"});
}

dismissBtn?.addEventListener("click",remove);
window.addEventListener("keydown",onKeyDown,true);
snoozeBtn?.addEventListener("click",onSnooze);
closeBtn?.addEventListener("click",onCloseTab);


}




async function main()
{
  const host = getHostKey();
  if(await isSnoozed(host)) return;

  
  init();
  
}

main();

let lastHref = location.href;
setInterval(() => {
  if (location.href !== lastHref) {
    lastHref = location.href;
    // show overlay on every navigation too (still matches your “every time”)
    main();
  }
}, 700);
// content.js
let keywords = [];
let enabled = false;

// Initial load
chrome.storage.sync.get(['enabled', 'keywords'], function(data) {
  enabled = data.enabled || false;
  keywords = (data.keywords || '').split(',').map(k => k.trim().toLowerCase()).filter(k => k);
  if (enabled) {
    scanAndMask();
  }
});

// Listen for updates from popup or storage changes
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "updateSettings") {
    enabled = request.enabled;
    keywords = (request.keywords || '').split(',').map(k => k.trim().toLowerCase()).filter(k => k);
    if (enabled) {
      scanAndMask();
    } else {
      removeMasks();
    }
  }
});

// Observer for dynamic content
let timeout = null;
const observer = new MutationObserver((mutations) => {
  if (enabled) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      scanAndMask();
    }, 500);
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

function scanAndMask() {
  if (!enabled) return;

  const textContainers = document.querySelectorAll('[data-view-name="feed-commentary"]');
  
  // Use Array.from to map/forEach, but since we are calling an async function,
  // we just fire it off. We don't need to await the entire batch to finish 
  // before the user can scroll, so parallel execution is fine.
  textContainers.forEach(container => {
    processPost(container);
  });
}

async function processPost(container) {
  // 1. Find the main post wrapper first
  let post = container.closest('div[data-urn]') || container.closest('li');
  if (!post) {
    post = container.parentElement;
  }

  // If no post wrapper, already masked, or permanently/temporarily revealed, skip
  if (!post || post.querySelector('.mask-overlay') || post.classList.contains('temporarily-revealed') || post.classList.contains('permanently-revealed')) return;

  const textContent = container.innerText;
  
  // 2. Ask the decision function (Future AI hook)
  const decision = await determineMasking(textContent);

  // 3. Apply mask if needed
  if (decision.shouldMask) {
    applyMask(post, decision.label);
  }
}

async function determineMasking(text) {
  // Logic: Currently keyword based. 
  // Future: Will call OpenRouter API here.
  
  if (!keywords || keywords.length === 0) {
    return { shouldMask: false, label: '' };
  }

  const lowerText = text.toLowerCase();
  const matchedKeyword = keywords.find(keyword => lowerText.includes(keyword));

  if (matchedKeyword) {
    return { shouldMask: true, label: matchedKeyword };
  }

  return { shouldMask: false, label: '' };
}

function applyMask(postElement, keyword) {
  // Ensure relative positioning for absolute overlay
  if (getComputedStyle(postElement).position === 'static') {
    postElement.style.position = 'relative';
  }

  const overlay = document.createElement('div');
  overlay.className = 'mask-overlay';
  overlay.innerHTML = `
    <div class="mask-content">
      <p>Hidden post with keyword: "<strong>${keyword}</strong>"</p>
      <button class="peek-btn">Peek</button>
      <button class="reveal-btn">Reveal</button>
    </div>
  `;

  // Add peak functionality
  overlay.querySelector('.peak-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    
    postElement.classList.add('temporarily-revealed');
    overlay.style.display = 'none'; // Hide overlay instead of removing

    setTimeout(() => {
      if (postElement) {
        postElement.classList.remove('temporarily-revealed');
        overlay.style.display = 'flex'; // Show it again
      }
    }, 5000);
  });

  // Add reveal functionality
  overlay.querySelector('.reveal-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    
    postElement.classList.add('permanently-revealed');
    overlay.remove();
  });

  postElement.appendChild(overlay);
}

function removeMasks() {
  const overlays = document.querySelectorAll('.mask-overlay');
  overlays.forEach(overlay => {
    const postElement = overlay.closest('div[data-urn]') || overlay.closest('li');
    if (postElement) {
      postElement.classList.remove('permanently-revealed', 'temporarily-revealed');
    }
    overlay.remove();
  });
}

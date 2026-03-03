const API_BASE = "http://localhost:8002";

const $ = (id) => document.getElementById(id);

function show(el) { el.classList.remove("hidden"); }
function hide(el) { el.classList.add("hidden"); }

function setLoading(active) {
  if (active) {
    show($("status"));
    hide($("result"));
    hide($("error"));
    $("sendPage").disabled = true;
    $("sendSelection").disabled = true;
  } else {
    hide($("status"));
    $("sendPage").disabled = false;
    $("sendSelection").disabled = false;
  }
}

function showError(msg) {
  $("errorText").textContent = msg;
  show($("error"));
  hide($("result"));
}

function showResult(data) {
  $("reasoning").textContent = data.reasoning;
  $("scanned").textContent = data.neurons_scanned;
  $("updates").textContent = data.updates.length;
  $("newNeurons").textContent = data.new_neurons.length;
  $("reviewLink").href = `${API_BASE}/admin/bolster`;
  $("reviewLink").addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: `${API_BASE}/admin/bolster` });
  });
  show($("result"));
}

async function extractPageContent() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const title = document.title;
      // Remove nav, header, footer, sidebar elements for cleaner text
      const clone = document.body.cloneNode(true);
      const remove = clone.querySelectorAll(
        "nav, header, footer, aside, [role='navigation'], [role='banner'], " +
        "[role='contentinfo'], script, style, noscript, iframe, svg"
      );
      remove.forEach((el) => el.remove());
      const text = clone.innerText.replace(/\n{3,}/g, "\n\n").trim();
      return { title, text };
    },
  });
  return results[0].result;
}

async function extractSelection() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const sel = window.getSelection();
      return sel ? sel.toString().trim() : "";
    },
  });
  return results[0].result;
}

async function sendToBolster(content) {
  const model = $("model").value;
  const department = $("department").value || undefined;

  // Truncate to stay under 5000 char API limit (leaving room for prefix)
  const maxChars = 4500;
  const truncated =
    content.length > maxChars ? content.slice(0, maxChars) + "\n\n[truncated]" : content;

  const body = {
    message: truncated,
    model,
  };
  if (department) body.department = department;

  const resp = await fetch(`${API_BASE}/admin/bolster`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`API error ${resp.status}: ${errBody}`);
  }

  return resp.json();
}

$("sendPage").addEventListener("click", async () => {
  setLoading(true);
  try {
    const { title, text } = await extractPageContent();
    if (!text) throw new Error("No content extracted from page");
    const message = `Ingest knowledge from this page:\n\n${title}\n\n${text}`;
    const data = await sendToBolster(message);
    showResult(data);
  } catch (err) {
    showError(err.message);
  } finally {
    setLoading(false);
  }
});

$("sendSelection").addEventListener("click", async () => {
  setLoading(true);
  try {
    const selection = await extractSelection();
    if (!selection) throw new Error("No text selected on the page");
    const message = `Ingest knowledge from this selection:\n\n${selection}`;
    const data = await sendToBolster(message);
    showResult(data);
  } catch (err) {
    showError(err.message);
  } finally {
    setLoading(false);
  }
});

const store = {
  apiBaseUrl: localStorage.getItem('giftsMiniappApiBaseUrl') || '',
  apiKey: localStorage.getItem('giftsMiniappApiKey') || '',
  adminToken: localStorage.getItem('giftsMiniappAdminToken') || '',
  giftAddress: localStorage.getItem('giftsMiniappGiftAddress') || '',
  ownerAddress: localStorage.getItem('giftsMiniappOwnerAddress') || '',
  webhookUrl: localStorage.getItem('giftsMiniappWebhookUrl') || '',
  batchAddresses: localStorage.getItem('giftsMiniappBatchAddresses') || '',
  log: []
};

const guideText = [
  'Frontend: deploy this repo to Vercel as a static site.',
  'Backend: deploy server.js to a separate API host.',
  'API base URL: set the deployed backend HTTPS URL in the miniapp.',
  'Required backend env vars: PUBLIC_URL, ADMIN_TOKEN, TONAPI_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRO_PRICE_ID.',
  'Vercel frontend does not store secrets. Keep secrets only in the backend host.',
  'Smoke test order:',
  '1. Open the Vercel site.',
  '2. Enter the backend URL and API key.',
  '3. Load the dashboard.',
  '4. Run gift lookup and owner inventory.',
  '5. Register and test a webhook.',
  '6. Trigger a Stripe checkout or demo key.',
  '',
  'Suggested split:',
  '- Vercel: index.html, miniapp.js, miniapp.css',
  '- API host: server.js, data storage, Redis, Stripe, TONAPI',
  '',
  'Backend URL examples:',
  '- https://api.yourdomain.com',
  '- https://your-app.onrender.com',
  '- https://your-service.fly.dev'
].join('\n');

const $ = (id) => document.getElementById(id);

function setState() {
  $('apiBaseUrl').value = store.apiBaseUrl;
  $('apiKey').value = store.apiKey;
  $('adminToken').value = store.adminToken;
  $('giftAddress').value = store.giftAddress;
  $('ownerAddress').value = store.ownerAddress;
  $('webhookUrl').value = store.webhookUrl;
  $('batchAddresses').value = store.batchAddresses;
  $('baseEcho').textContent = store.apiBaseUrl || 'not set';
  $('keyEcho').textContent = store.apiKey ? `${store.apiKey.slice(0, 10)}…` : 'not set';
  const guideEl = $('guideText');
  if (guideEl) {
    guideEl.textContent = guideText;
  }
}

function saveState() {
  store.apiBaseUrl = $('apiBaseUrl').value.trim().replace(/\/$/, '');
  store.apiKey = $('apiKey').value.trim();
  store.adminToken = $('adminToken').value.trim();
  store.giftAddress = $('giftAddress').value.trim();
  store.ownerAddress = $('ownerAddress').value.trim();
  store.webhookUrl = $('webhookUrl').value.trim();
  store.batchAddresses = $('batchAddresses').value.trim();
  localStorage.setItem('giftsMiniappApiBaseUrl', store.apiBaseUrl);
  localStorage.setItem('giftsMiniappApiKey', store.apiKey);
  localStorage.setItem('giftsMiniappAdminToken', store.adminToken);
  localStorage.setItem('giftsMiniappGiftAddress', store.giftAddress);
  localStorage.setItem('giftsMiniappOwnerAddress', store.ownerAddress);
  localStorage.setItem('giftsMiniappWebhookUrl', store.webhookUrl);
  localStorage.setItem('giftsMiniappBatchAddresses', store.batchAddresses);
  $('baseEcho').textContent = store.apiBaseUrl || 'not set';
  $('keyEcho').textContent = store.apiKey ? `${store.apiKey.slice(0, 10)}…` : 'not set';
}

function log(kind, message, payload) {
  store.log.unshift({
    time: new Date().toLocaleTimeString(),
    kind,
    message,
    payload
  });
  store.log = store.log.slice(0, 8);
  $('log').innerHTML = store.log
    .map(
      (entry) => `
        <div class="item">
          <div class="top">
            <strong>${entry.kind}</strong>
            <span class="hint">${entry.time}</span>
          </div>
          <div>${entry.message}</div>
        </div>`
    )
    .join('');
}

function authHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (store.apiKey) headers['x-api-key'] = store.apiKey;
  if (store.adminToken) headers['x-admin-token'] = store.adminToken;
  return headers;
}

function buildUrl(path) {
  if (!store.apiBaseUrl) throw new Error('Set API base URL first');
  return `${store.apiBaseUrl}${path}`;
}

async function callApi(path, options = {}) {
  const response = await fetch(buildUrl(path), {
    ...options,
    headers: {
      ...authHeaders(),
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!response.ok) {
    const error = new Error(body?.error || `Request failed with ${response.status}`);
    error.body = body;
    throw error;
  }

  $('response').textContent = JSON.stringify(body, null, 2);
  return body;
}

function renderMetrics(data) {
  const metrics = data?.metrics || {};
  const totals = metrics.totals || {};
  const ratios = metrics.ratios || {};
  const latency = metrics.latency || {};
  const market = metrics.market || {};
  const cards = [
    ['Requests', totals.requests, 'All API calls since startup'],
    ['Cache hit ratio', `${ratios.cacheHitRatio ?? 0}%`, 'Redis or memory cache'],
    ['Webhook success', `${ratios.webhookSuccessRate ?? 0}%`, 'Delivery success rate'],
    ['Latency p95', `${latency.p95 ?? 0} ms`, 'Tail latency'],
    ['Active keys', market.apiKeys ?? 0, 'Active customer keys'],
    ['Estimated MRR', `$${Math.round(market.mrr ?? 0)}`, 'Approximate recurring revenue']
  ];

  $('metricsGrid').innerHTML = cards
    .map(
      ([label, value, note]) => `
        <div class="metric">
          <div class="k">${label}</div>
          <div class="v">${value}</div>
          <div class="n">${note}</div>
        </div>`
    )
    .join('');

  const customer = data?.customer;
  $('customerPanel').innerHTML = customer
    ? `
      <div class="item">
        <div class="top"><strong>${customer.plan?.name || customer.planId || 'Unknown plan'}</strong><span class="hint">${customer.status}</span></div>
        <div>Email: ${customer.email || 'n/a'}</div>
        <div>Usage: ${customer.currentUsage}/${customer.maxCalls}</div>
        <div>Webhook: ${customer.webhookUrl || 'not registered'}</div>
        <div>Remaining: ${customer.remainingCalls}</div>
        <div>Created: ${customer.createdAt || 'n/a'}</div>
      </div>`
    : '<div class="item">No customer record returned. Paste a valid API key.</div>';

  const collections = data?.collections?.top || [];
  $('collectionsPanel').innerHTML = collections.length
    ? collections
        .map(
          (collection) => `
            <div class="item">
              <div class="top">
                <strong>${collection.name}</strong>
                <span class="hint">${collection.floorPriceTon ?? 0} TON</span>
              </div>
              <div>${collection.description || 'No description'}</div>
              <div class="hint">Supply ${collection.supply || 0} · Holders ${collection.holders || 0} · 24h ${collection.volume24hTon || 0} TON</div>
            </div>`
        )
        .join('')
    : '<div class="item">No collections returned.</div>';
}

async function refreshDashboard() {
  saveState();
  $('connectionState').textContent = 'Loading';
  try {
    const query = new URLSearchParams();
    if (store.apiKey) query.set('api_key', store.apiKey);
    if (store.adminToken) query.set('admin_token', store.adminToken);
    const data = await callApi(`/api/dashboard${query.toString() ? `?${query}` : ''}`, {
      method: 'GET'
    });
    renderMetrics(data);
    $('connectionState').textContent = 'Connected';
    log('dashboard', 'Loaded dashboard overview', data?.service);
  } catch (error) {
    $('connectionState').textContent = 'Error';
    log('error', error.message, error.body || null);
  }
}

async function issueDemoKey() {
  saveState();
  const data = await callApi('/api/subscriptions/create', {
    method: 'POST',
    body: JSON.stringify({
      email: 'demo@local.test',
      planId: 'pro'
    })
  });

  if (data.apiKey) {
    store.apiKey = data.apiKey;
    $('apiKey').value = data.apiKey;
    localStorage.setItem('giftsMiniappApiKey', data.apiKey);
  }

  log('billing', 'Issued a demo API key', data);
}

async function doHealthCheck() {
  const data = await callApi('/healthz', { method: 'GET', headers: {} });
  log('health', 'Fetched health check', data);
}

async function getGift() {
  const address = $('giftAddress').value.trim();
  if (!address) throw new Error('Set a gift address first');
  const data = await callApi(`/api/gifts/${encodeURIComponent(address)}`, { method: 'GET' });
  log('gift', `Loaded gift ${address}`, data);
}

async function getOwner() {
  const owner = $('ownerAddress').value.trim();
  if (!owner) throw new Error('Set an owner address first');
  const data = await callApi(`/api/gifts/owner/${encodeURIComponent(owner)}`, { method: 'GET' });
  log('owner', `Loaded owner inventory for ${owner}`, data);
}

async function batchLookup() {
  const addresses = $('batchAddresses').value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (!addresses.length) throw new Error('Provide at least one address');
  const data = await callApi('/api/gifts/batch', {
    method: 'POST',
    body: JSON.stringify({ addresses })
  });
  log('batch', `Loaded ${data.total} addresses`, data);
}

async function registerWebhook() {
  const webhookUrl = $('webhookUrl').value.trim();
  if (!webhookUrl) throw new Error('Set a webhook URL first');
  const data = await callApi('/api/webhooks/register', {
    method: 'POST',
    body: JSON.stringify({ webhookUrl })
  });
  log('webhook', 'Registered webhook URL', data);
}

async function testWebhook() {
  const data = await callApi('/api/webhooks/test', {
    method: 'POST',
    body: JSON.stringify({})
  });
  log('webhook', 'Triggered webhook test', data);
}

async function discoverCollections() {
  const data = await callApi('/api/collections/discover', {
    method: 'GET'
  });
  log('collections', 'Requested collection discovery', data);
}

document.addEventListener('DOMContentLoaded', () => {
  setState();
  $('saveButton').addEventListener('click', refreshDashboard);
  $('loadKeyButton').addEventListener('click', issueDemoKey);
  $('healthButton').addEventListener('click', doHealthCheck);
  $('dashboardButton').addEventListener('click', refreshDashboard);
  $('giftButton').addEventListener('click', getGift);
  $('ownerButton').addEventListener('click', getOwner);
  $('batchButton').addEventListener('click', batchLookup);
  $('registerWebhookButton').addEventListener('click', registerWebhook);
  $('testWebhookButton').addEventListener('click', testWebhook);
  $('collectionsButton').addEventListener('click', discoverCollections);

  const copyGuideButton = $('copyGuideButton');
  if (copyGuideButton) {
    copyGuideButton.addEventListener('click', async () => {
      await navigator.clipboard.writeText(guideText);
      log('guide', 'Copied split-deploy guide to clipboard');
    });
  }

  const openVercelButton = $('openVercelButton');
  if (openVercelButton) {
    openVercelButton.addEventListener('click', () => {
      window.open('https://vercel.com/docs', '_blank', 'noopener,noreferrer');
    });
  }

  ['apiBaseUrl', 'apiKey', 'adminToken', 'giftAddress', 'ownerAddress', 'webhookUrl', 'batchAddresses'].forEach((id) => {
    $(id).addEventListener('change', () => {
      saveState();
      setState();
    });
  });

  log('ready', 'Miniapp loaded. Set the API base URL and API key to begin.');
});

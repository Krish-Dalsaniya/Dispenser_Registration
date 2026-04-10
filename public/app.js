document.addEventListener('DOMContentLoaded', () => {
  const API = '/api';

  // ============================================================
  //  STATE
  // ============================================================
  let state = {
    types: [],
    features: [],
    bundles: [],
    customers: [],
    devices: [],
    dashboard: { devices: 0, bundles: 0, customers: 0, features: 0, types: 0 },
  };

  // ============================================================
  //  NAVIGATION
  // ============================================================
  const navBtns = document.querySelectorAll('.nav-btn');
  const viewSections = document.querySelectorAll('.view-section');
  const pageTitle = document.getElementById('page-title');

  const titleMap = {
    'dashboard-view': 'Dashboard Overview',
    'types-view': 'Firmware Types',
    'features-view': 'Firmware Features',
    'bundles-view': 'Firmware Bundles',
    'customers-view': 'Customers',
    'devices-view': 'Device Registration',
  };

  navBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      navBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.dataset.target;
      viewSections.forEach((s) => {
        s.classList.remove('active');
        if (s.id === target) s.classList.add('active');
      });
      pageTitle.textContent = titleMap[target] || 'Portal';
    });
  });

  // ============================================================
  //  TOAST NOTIFICATIONS
  // ============================================================
  function toast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `
      <span class="toast-icon">${type === 'success' ? '✅' : '❌'}</span>
      <span>${message}</span>
    `;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

  // ============================================================
  //  DATA FETCHING
  // ============================================================
  async function fetchAll() {
    try {
      const [dashRes, typesRes, featuresRes, bundlesRes, customersRes, devicesRes] =
        await Promise.all([
          fetch(`${API}/dashboard`),
          fetch(`${API}/firmware-types`),
          fetch(`${API}/firmware-features`),
          fetch(`${API}/firmware-bundles`),
          fetch(`${API}/customers`),
          fetch(`${API}/devices`),
        ]);

      if (dashRes.ok) state.dashboard = await dashRes.json();
      if (typesRes.ok) state.types = await typesRes.json();
      if (featuresRes.ok) state.features = await featuresRes.json();
      if (bundlesRes.ok) state.bundles = await bundlesRes.json();
      if (customersRes.ok) state.customers = await customersRes.json();
      if (devicesRes.ok) state.devices = await devicesRes.json();

      renderAll();
    } catch (err) {
      console.error('Fetch error:', err);
      toast('Failed to load data', 'error');
    }
  }

  function renderAll() {
    renderDashboard();
    renderTypes();
    renderFeatures();
    renderBundles();
    renderBundleFormCheckboxes();
    renderCustomers();
    renderDevices();
    populateDeviceSelects();
  }

  // ============================================================
  //  DASHBOARD
  // ============================================================
  function renderDashboard() {
    document.getElementById('stat-devices').textContent = state.dashboard.devices;
    document.getElementById('stat-bundles').textContent = state.dashboard.bundles;
    document.getElementById('stat-customers').textContent = state.dashboard.customers;
    document.getElementById('stat-features').textContent = state.dashboard.features;
    document.getElementById('stat-types').textContent = state.dashboard.types;

    // Recent registrations (top 5)
    const tbody = document.getElementById('dashboard-recent-tbody');
    const recent = state.devices.slice(0, 5);
    if (recent.length === 0) {
      tbody.innerHTML = `
        <tr><td colspan="7">
          <div class="empty-state">
            <div class="empty-icon">📱</div>
            <p>No devices registered yet</p>
          </div>
        </td></tr>`;
      return;
    }
    tbody.innerHTML = recent
      .map(
        (d) => `
      <tr>
        <td class="text-mono">${d.dispenser_id}</td>
        <td>${d.dispenser_name || '—'}</td>
        <td>${d.customer_name}</td>
        <td><span class="badge badge-primary">${d.firmware_version}</span></td>
        <td>${d.location || '—'}</td>
        <td><span class="badge ${d.is_iot ? 'badge-success' : 'badge-muted'}">${d.is_iot ? 'IoT' : 'Standard'}</span></td>
        <td>${formatDate(d.registration_date)}</td>
      </tr>`
      )
      .join('');
  }

  // ============================================================
  //  FIRMWARE TYPES
  // ============================================================
  function renderTypes() {
    const tbody = document.getElementById('types-tbody');
    if (state.types.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><div class="empty-icon">🏷️</div><p>No firmware types yet</p></div></td></tr>`;
      return;
    }
    tbody.innerHTML = state.types
      .map(
        (t) => `
      <tr>
        <td class="text-mono">${t.type_id}</td>
        <td><strong>${t.type_name}</strong></td>
        <td class="text-muted">${t.description || '—'}</td>
        <td><button class="btn btn-danger" onclick="deleteType(${t.type_id})">🗑️</button></td>
      </tr>`
      )
      .join('');
  }

  document.getElementById('type-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      type_name: document.getElementById('type-name').value.trim(),
      description: document.getElementById('type-desc').value.trim(),
    };
    try {
      const res = await fetch(`${API}/firmware-types`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast('Firmware type added successfully');
        e.target.reset();
        fetchAll();
      } else {
        const err = await res.json();
        toast(err.error || 'Failed to add type', 'error');
      }
    } catch (err) {
      toast('Network error', 'error');
    }
  });

  window.deleteType = async (id) => {
    if (!confirm('Delete this firmware type?')) return;
    try {
      await fetch(`${API}/firmware-types/${id}`, { method: 'DELETE' });
      toast('Firmware type deleted');
      fetchAll();
    } catch (err) {
      toast('Failed to delete', 'error');
    }
  };

  // ============================================================
  //  FIRMWARE FEATURES
  // ============================================================
  function renderFeatures() {
    const tbody = document.getElementById('features-tbody');
    if (state.features.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><div class="empty-icon">🧩</div><p>No features yet</p></div></td></tr>`;
      return;
    }
    tbody.innerHTML = state.features
      .map(
        (f) => `
      <tr>
        <td class="text-mono">${f.feature_id}</td>
        <td><strong>${f.feature_name}</strong></td>
        <td><span class="badge badge-info">${f.category || '—'}</span></td>
        <td><button class="btn btn-danger" onclick="deleteFeature(${f.feature_id})">🗑️</button></td>
      </tr>`
      )
      .join('');
  }

  document.getElementById('feature-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      feature_name: document.getElementById('feature-name').value.trim(),
      category: document.getElementById('feature-category').value.trim(),
    };
    try {
      const res = await fetch(`${API}/firmware-features`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast('Feature added successfully');
        e.target.reset();
        fetchAll();
      } else {
        const err = await res.json();
        toast(err.error || 'Failed to add feature', 'error');
      }
    } catch (err) {
      toast('Network error', 'error');
    }
  });

  window.deleteFeature = async (id) => {
    if (!confirm('Delete this feature?')) return;
    try {
      await fetch(`${API}/firmware-features/${id}`, { method: 'DELETE' });
      toast('Feature deleted');
      fetchAll();
    } catch (err) {
      toast('Failed to delete', 'error');
    }
  };

  // ============================================================
  //  FIRMWARE BUNDLES
  // ============================================================
  function renderBundleFormCheckboxes() {
    // Features checkboxes
    const featGrid = document.getElementById('bundle-features-grid');
    featGrid.innerHTML = state.features
      .map(
        (f) => `
      <label class="checkbox-item" data-feature-id="${f.feature_id}">
        <input type="checkbox" value="${f.feature_id}" class="bundle-feature-cb" onchange="updateHashPreview()">
        <div>
          <div class="cb-name">${f.feature_name}</div>
          <div class="cb-category">${f.category || ''}</div>
        </div>
      </label>`
      )
      .join('');

    if (state.features.length === 0) {
      featGrid.innerHTML = '<div class="text-muted" style="padding:0.5rem">No features available. Add some first.</div>';
    }

    // Types checkboxes
    const typeGrid = document.getElementById('bundle-types-grid');
    typeGrid.innerHTML = state.types
      .map(
        (t) => `
      <label class="checkbox-item" data-type-id="${t.type_id}">
        <input type="checkbox" value="${t.type_id}" class="bundle-type-cb">
        <div>
          <div class="cb-name">${t.type_name}</div>
          <div class="cb-category">${t.description || ''}</div>
        </div>
      </label>`
      )
      .join('');

    if (state.types.length === 0) {
      typeGrid.innerHTML = '<div class="text-muted" style="padding:0.5rem">No types available. Add some first.</div>';
    }
  }

  // Update hash preview on checkbox change
  window.updateHashPreview = () => {
    const checked = [...document.querySelectorAll('.bundle-feature-cb:checked')].map((cb) =>
      parseInt(cb.value)
    );
    checked.sort((a, b) => a - b);
    const hash = checked.length > 0 ? checked.join('_') : '—';
    document.getElementById('hash-value').textContent = hash;

    // Visual feedback on checkbox items
    document.querySelectorAll('#bundle-features-grid .checkbox-item').forEach((item) => {
      const cb = item.querySelector('input[type="checkbox"]');
      item.classList.toggle('checked', cb.checked);
    });
    document.querySelectorAll('#bundle-types-grid .checkbox-item').forEach((item) => {
      const cb = item.querySelector('input[type="checkbox"]');
      item.classList.toggle('checked', cb.checked);
    });
  };

  // IoT toggle in bundle form
  document.getElementById('bundle-iot').addEventListener('change', (e) => {
    const isIoT = e.target.checked;
    document.getElementById('bundle-iot-label').textContent = isIoT ? 'Yes' : 'No';
    const featSection = document.getElementById('bundle-features-section');
    
    if (!isIoT) {
      // Clear features
      document.querySelectorAll('.bundle-feature-cb').forEach(cb => {
        cb.checked = false;
      });
      featSection.style.display = 'none';
      updateHashPreview();
    } else {
      featSection.style.display = 'block';
    }
  });

  // Listen for type checkbox changes too
  document.getElementById('bundle-types-grid').addEventListener('change', () => {
    document.querySelectorAll('#bundle-types-grid .checkbox-item').forEach((item) => {
      const cb = item.querySelector('input[type="checkbox"]');
      item.classList.toggle('checked', cb.checked);
    });
  });

  function renderBundles() {
    const tbody = document.getElementById('bundles-tbody');
    if (state.bundles.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">📦</div><p>No bundles created yet</p></div></td></tr>`;
      return;
    }
    tbody.innerHTML = state.bundles
      .map(
        (b) => `
      <tr>
        <td class="text-mono">${b.firmware_id}</td>
        <td class="text-mono">${b.combination_hash}</td>
        <td><span class="badge badge-primary">${b.version_string}</span></td>
        <td>
          <div class="tag-list">
            ${b.features.map((f) => `<span class="tag">${f.feature_name}</span>`).join('')}
          </div>
        </td>
        <td>
          <div class="tag-list">
            ${b.types.map((t) => `<span class="tag tag-type">${t.type_name}</span>`).join('')}
          </div>
        </td>
        <td>${formatDate(b.created_at)}</td>
        <td><button class="btn btn-danger" onclick="deleteBundle(${b.firmware_id})">🗑️</button></td>
      </tr>`
      )
      .join('');
  }

  document.getElementById('bundle-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const feature_ids = [...document.querySelectorAll('.bundle-feature-cb:checked')].map(
      (cb) => parseInt(cb.value)
    );
    const type_ids = [...document.querySelectorAll('.bundle-type-cb:checked')].map(
      (cb) => parseInt(cb.value)
    );
    const is_iot = document.getElementById('bundle-iot').checked;
    const version_string = document.getElementById('bundle-version').value.trim();

    if (is_iot && feature_ids.length === 0) {
      toast('Please select at least one feature for IoT bundles', 'error');
      return;
    }

    const payload = { feature_ids, type_ids, version_string, is_iot };

    try {
      const res = await fetch(`${API}/firmware-bundles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast('Firmware bundle created successfully');
        e.target.reset();
        document.getElementById('bundle-iot-label').textContent = 'Yes';
        document.getElementById('bundle-features-section').style.display = 'block';
        document.getElementById('hash-value').textContent = '—';
        document.querySelectorAll('.checkbox-item').forEach((i) => i.classList.remove('checked'));
        fetchAll();
      } else if (res.status === 409) {
        const data = await res.json();
        toast(`Bundle already exists (ID: ${data.existing.firmware_id})`, 'error');
      } else {
        const err = await res.json();
        toast(err.error || 'Failed to create bundle', 'error');
      }
    } catch (err) {
      toast('Network error', 'error');
    }
  });

  window.deleteBundle = async (id) => {
    if (!confirm('Delete this bundle? This will fail if devices reference it.')) return;
    try {
      const res = await fetch(`${API}/firmware-bundles/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast('Bundle deleted');
        fetchAll();
      } else {
        toast('Cannot delete — devices may reference this bundle', 'error');
      }
    } catch (err) {
      toast('Failed to delete', 'error');
    }
  };

  // ============================================================
  //  CUSTOMERS
  // ============================================================
  function renderCustomers() {
    const tbody = document.getElementById('customers-tbody');
    if (state.customers.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3"><div class="empty-state"><div class="empty-icon">🏢</div><p>No customers yet</p></div></td></tr>`;
      return;
    }
    tbody.innerHTML = state.customers
      .map(
        (c) => `
      <tr>
        <td class="text-mono">${c.customer_id}</td>
        <td><strong>${c.customer_name}</strong></td>
        <td><button class="btn btn-danger" onclick="deleteCustomer(${c.customer_id})">🗑️</button></td>
      </tr>`
      )
      .join('');
  }

  document.getElementById('customer-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      customer_name: document.getElementById('customer-name').value.trim(),
    };
    try {
      const res = await fetch(`${API}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast('Customer added successfully');
        e.target.reset();
        fetchAll();
      } else {
        const err = await res.json();
        toast(err.error || 'Failed to add customer', 'error');
      }
    } catch (err) {
      toast('Network error', 'error');
    }
  });

  window.deleteCustomer = async (id) => {
    if (!confirm('Delete this customer? Associated devices will also be deleted.')) return;
    try {
      await fetch(`${API}/customers/${id}`, { method: 'DELETE' });
      toast('Customer deleted');
      fetchAll();
    } catch (err) {
      toast('Failed to delete', 'error');
    }
  };

  // ============================================================
  //  DEVICES
  // ============================================================
  function populateDeviceSelects() {
    // Customers dropdown
    const custSelect = document.getElementById('dev-customer');
    if (!custSelect) return;
    custSelect.innerHTML = '<option value="">Select Customer</option>';
    state.customers.forEach((c) => {
      custSelect.innerHTML += `<option value="${c.customer_id}">${c.customer_name}</option>`;
    });

    // Bundles dropdown (filtered by IoT status)
    const fwSelect = document.getElementById('dev-firmware');
    if (!fwSelect) return;
    const isDeviceIoT = document.getElementById('dev-iot').checked;
    
    fwSelect.innerHTML = '<option value="">Select Bundle</option>';
    state.bundles
      .filter(b => b.is_iot === isDeviceIoT)
      .forEach((b) => {
        const featureNames = b.features.length > 0 
          ? ` (${b.features.map((f) => f.feature_name).join(', ')})` 
          : ' (Standard Bundle)';
        fwSelect.innerHTML += `<option value="${b.firmware_id}">${b.version_string} — ${b.combination_hash}${featureNames}</option>`;
      });
  }

  function renderDevices() {
    const tbody = document.getElementById('devices-tbody');
    if (state.devices.length === 0) {
      tbody.innerHTML = `<tr><td colspan="11"><div class="empty-state"><div class="empty-icon">📱</div><p>No devices registered yet</p></div></td></tr>`;
      return;
    }
    tbody.innerHTML = state.devices
      .map(
        (d) => `
      <tr>
        <td class="text-mono">${d.dispenser_id}</td>
        <td><strong>${d.dispenser_name || '—'}</strong></td>
        <td>${d.customer_name}</td>
        <td><span class="badge badge-primary">${d.firmware_version}</span></td>
        <td class="text-mono">${d.mcu_id || '—'}</td>
        <td>${d.pcb_id ? `${d.pcb_id} / ${d.pcb_name || ''}` : '—'}</td>
        <td>${d.location || '—'}</td>
        <td>${d.fuel_type ? `<span class="badge badge-warning">${d.fuel_type}</span>` : '—'}</td>
        <td><span class="badge ${d.is_iot ? 'badge-success' : 'badge-muted'}">${d.is_iot ? 'IoT' : 'Standard'}</span></td>
        <td>${formatDate(d.registration_date)}</td>
        <td><button class="btn btn-danger" onclick="deleteDevice(${d.dispenser_id})">🗑️</button></td>
      </tr>`
      )
      .join('');
  }

  // IoT toggle label
  document.getElementById('dev-iot').addEventListener('change', (e) => {
    document.getElementById('dev-iot-label').textContent = e.target.checked ? 'Yes' : 'No';
    populateDeviceSelects(); // Regenerate bundle list based on device type
  });

  document.getElementById('device-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      firmware_id: parseInt(document.getElementById('dev-firmware').value),
      customer_id: parseInt(document.getElementById('dev-customer').value),
      dispenser_name: document.getElementById('dev-name').value.trim(),
      pcb_id: document.getElementById('dev-pcb-id').value.trim(),
      pcb_name: document.getElementById('dev-pcb-name').value.trim(),
      mcu_id: document.getElementById('dev-mcu-id').value.trim(),
      latitude: document.getElementById('dev-lat').value.trim(),
      longitude: document.getElementById('dev-lng').value.trim(),
      location: document.getElementById('dev-location').value.trim(),
      fuel_type: document.getElementById('dev-fuel').value,
      is_iot: document.getElementById('dev-iot').checked,
    };

    try {
      const res = await fetch(`${API}/devices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast('Device registered successfully');
        e.target.reset();
        document.getElementById('dev-iot-label').textContent = 'No';
        fetchAll();
      } else {
        const err = await res.json();
        toast(err.error || 'Failed to register device', 'error');
      }
    } catch (err) {
      toast('Network error', 'error');
    }
  });

  window.deleteDevice = async (id) => {
    if (!confirm('Delete this device registration?')) return;
    try {
      await fetch(`${API}/devices/${id}`, { method: 'DELETE' });
      toast('Device deleted');
      fetchAll();
    } catch (err) {
      toast('Failed to delete', 'error');
    }
  };

  // ============================================================
  //  UTILITIES
  // ============================================================
  function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  // ============================================================
  //  INITIAL LOAD
  // ============================================================
  fetchAll();
});

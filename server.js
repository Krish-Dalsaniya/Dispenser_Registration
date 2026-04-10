const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
//  DASHBOARD
// ============================================================
app.get('/api/dashboard', async (req, res) => {
  try {
    const [devices, bundles, customers, features, types] = await Promise.all([
      db.query('SELECT COUNT(*) FROM device_registration'),
      db.query('SELECT COUNT(*) FROM firmware_bundle'),
      db.query('SELECT COUNT(*) FROM customer'),
      db.query('SELECT COUNT(*) FROM firmware_feature'),
      db.query('SELECT COUNT(*) FROM firmware_type'),
    ]);
    res.json({
      devices: parseInt(devices.rows[0].count),
      bundles: parseInt(bundles.rows[0].count),
      customers: parseInt(customers.rows[0].count),
      features: parseInt(features.rows[0].count),
      types: parseInt(types.rows[0].count),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
//  FIRMWARE TYPES
// ============================================================
app.get('/api/firmware-types', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM firmware_type ORDER BY type_id ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/firmware-types', async (req, res) => {
  const { type_name, description } = req.body;
  if (!type_name) return res.status(400).json({ error: 'type_name is required' });
  try {
    const { rows } = await db.query(
      'INSERT INTO firmware_type (type_name, description) VALUES ($1, $2) RETURNING *',
      [type_name, description || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/firmware-types/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM firmware_type WHERE type_id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
//  FIRMWARE FEATURES
// ============================================================
app.get('/api/firmware-features', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM firmware_feature ORDER BY feature_id ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/firmware-features', async (req, res) => {
  const { feature_name, category } = req.body;
  if (!feature_name) return res.status(400).json({ error: 'feature_name is required' });
  try {
    const { rows } = await db.query(
      'INSERT INTO firmware_feature (feature_name, category) VALUES ($1, $2) RETURNING *',
      [feature_name, category || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/firmware-features/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM firmware_feature WHERE feature_id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
//  FIRMWARE BUNDLES (CORE LOGIC)
// ============================================================
app.get('/api/firmware-bundles', async (req, res) => {
  try {
    // Get all bundles
    const { rows: bundles } = await db.query(
      'SELECT * FROM firmware_bundle ORDER BY firmware_id ASC'
    );

    // For each bundle, get features and types
    const enriched = await Promise.all(
      bundles.map(async (bundle) => {
        const [featureRes, typeRes] = await Promise.all([
          db.query(
            `SELECT ff.feature_id, ff.feature_name, ff.category 
             FROM bundle_feature_map bfm 
             JOIN firmware_feature ff ON bfm.feature_id = ff.feature_id 
             WHERE bfm.firmware_id = $1`,
            [bundle.firmware_id]
          ),
          db.query(
            `SELECT ft.type_id, ft.type_name 
             FROM bundle_type_map btm 
             JOIN firmware_type ft ON btm.type_id = ft.type_id 
             WHERE btm.firmware_id = $1`,
            [bundle.firmware_id]
          ),
        ]);
        return {
          ...bundle,
          features: featureRes.rows,
          types: typeRes.rows,
        };
      })
    );

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/firmware-bundles', async (req, res) => {
  const { feature_ids, type_ids, version_string, is_iot } = req.body;

  if (is_iot !== false && (!feature_ids || !Array.isArray(feature_ids) || feature_ids.length === 0)) {
    return res.status(400).json({ error: 'feature_ids array is required for IoT bundles' });
  }
  if (!version_string) {
    return res.status(400).json({ error: 'version_string is required' });
  }

  // Generate combination_hash
  let combination_hash = 'NONE';
  if (is_iot !== false) {
    const sorted = [...feature_ids].map(Number).sort((a, b) => a - b);
    combination_hash = sorted.join('_');
  } else {
    // For non-IoT bundles, we'll use a timestamp-based hash or similar to allow multiple featureless bundles
    combination_hash = `BASIC_${Date.now()}`;
  }

  try {
    // Check if bundle already exists
    const existing = await db.query(
      'SELECT * FROM firmware_bundle WHERE combination_hash = $1',
      [combination_hash]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        error: 'Firmware bundle with this feature combination already exists',
        existing: existing.rows[0],
      });
    }

    // Create bundle
    const { rows } = await db.query(
      'INSERT INTO firmware_bundle (combination_hash, version_string, is_iot) VALUES ($1, $2, $3) RETURNING *',
      [combination_hash, version_string, is_iot ?? true]
    );
    const bundle = rows[0];

    // Insert feature mappings (only if IoT)
    if (is_iot !== false) {
      const sorted = [...feature_ids].map(Number).sort((a, b) => a - b);
      for (const fid of sorted) {
        await db.query(
          'INSERT INTO bundle_feature_map (firmware_id, feature_id) VALUES ($1, $2)',
          [bundle.firmware_id, fid]
        );
      }
    }

    // Insert type mappings
    if (type_ids && Array.isArray(type_ids)) {
      for (const tid of type_ids) {
        await db.query(
          'INSERT INTO bundle_type_map (firmware_id, type_id) VALUES ($1, $2)',
          [bundle.firmware_id, Number(tid)]
        );
      }
    }

    res.status(201).json(bundle);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/firmware-bundles/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM firmware_bundle WHERE firmware_id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
//  CUSTOMERS
// ============================================================
app.get('/api/customers', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM customer ORDER BY customer_id ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/customers', async (req, res) => {
  const { customer_name } = req.body;
  if (!customer_name) return res.status(400).json({ error: 'customer_name is required' });
  try {
    const { rows } = await db.query(
      'INSERT INTO customer (customer_name) VALUES ($1) RETURNING *',
      [customer_name]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/customers/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM customer WHERE customer_id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
//  DEVICE REGISTRATION
// ============================================================
app.get('/api/devices', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT 
        d.*,
        c.customer_name,
        fb.combination_hash,
        fb.version_string AS firmware_version
      FROM device_registration d
      JOIN customer c ON d.customer_id = c.customer_id
      JOIN firmware_bundle fb ON d.firmware_id = fb.firmware_id
      ORDER BY d.dispenser_id DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/devices', async (req, res) => {
  const {
    firmware_id,
    customer_id,
    dispenser_name,
    pcb_id,
    pcb_name,
    mcu_id,
    latitude,
    longitude,
    location,
    fuel_type,
    is_iot,
  } = req.body;

  if (!firmware_id || !customer_id) {
    return res.status(400).json({ error: 'firmware_id and customer_id are required' });
  }

  try {
    const { rows } = await db.query(
      `INSERT INTO device_registration 
        (firmware_id, customer_id, dispenser_name, pcb_id, pcb_name, mcu_id, latitude, longitude, location, fuel_type, is_iot)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
       RETURNING *`,
      [
        firmware_id,
        customer_id,
        dispenser_name || null,
        pcb_id || null,
        pcb_name || null,
        mcu_id || null,
        latitude || null,
        longitude || null,
        location || null,
        fuel_type || null,
        is_iot ?? false,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/devices/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM device_registration WHERE dispenser_id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
//  START SERVER
// ============================================================
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

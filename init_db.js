const { Client } = require('pg');
require('dotenv').config();

const schema = `
  -- 1. FIRMWARE TYPE
  CREATE TABLE IF NOT EXISTS firmware_type (
      type_id SERIAL PRIMARY KEY,
      type_name VARCHAR(100) NOT NULL,
      description TEXT
  );

  -- 2. FIRMWARE FEATURE
  CREATE TABLE IF NOT EXISTS firmware_feature (
      feature_id SERIAL PRIMARY KEY,
      feature_name VARCHAR(100) NOT NULL,
      category VARCHAR(100)
  );

  -- 3. FIRMWARE BUNDLE
  CREATE TABLE IF NOT EXISTS firmware_bundle (
      firmware_id SERIAL PRIMARY KEY,
      combination_hash VARCHAR(255) UNIQUE NOT NULL,
      version_string VARCHAR(50),
      is_iot BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- 4. BUNDLE <-> FEATURE MAP
  CREATE TABLE IF NOT EXISTS bundle_feature_map (
      firmware_id INT NOT NULL,
      feature_id INT NOT NULL,
      PRIMARY KEY (firmware_id, feature_id),
      FOREIGN KEY (firmware_id) REFERENCES firmware_bundle(firmware_id) ON DELETE CASCADE,
      FOREIGN KEY (feature_id) REFERENCES firmware_feature(feature_id) ON DELETE CASCADE
  );

  -- 5. BUNDLE <-> TYPE MAP
  CREATE TABLE IF NOT EXISTS bundle_type_map (
      firmware_id INT NOT NULL,
      type_id INT NOT NULL,
      PRIMARY KEY (firmware_id, type_id),
      FOREIGN KEY (firmware_id) REFERENCES firmware_bundle(firmware_id) ON DELETE CASCADE,
      FOREIGN KEY (type_id) REFERENCES firmware_type(type_id) ON DELETE CASCADE
  );

  -- 6. CUSTOMER
  CREATE TABLE IF NOT EXISTS customer (
      customer_id SERIAL PRIMARY KEY,
      customer_name VARCHAR(150) NOT NULL
  );

  -- 7. DEVICE REGISTRATION
  CREATE TABLE IF NOT EXISTS device_registration (
      dispenser_id SERIAL PRIMARY KEY,
      firmware_id INT NOT NULL,
      customer_id INT NOT NULL,
      dispenser_name VARCHAR(100),
      pcb_id VARCHAR(50),
      pcb_name VARCHAR(100),
      mcu_id VARCHAR(20),
      latitude VARCHAR(20),
      longitude VARCHAR(20),
      location VARCHAR(50),
      fuel_type VARCHAR(50),
      is_iot BOOLEAN DEFAULT FALSE,
      registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (firmware_id) REFERENCES firmware_bundle(firmware_id) ON DELETE RESTRICT,
      FOREIGN KEY (customer_id) REFERENCES customer(customer_id) ON DELETE CASCADE
  );

  -- 8. INDEXES
  CREATE INDEX IF NOT EXISTS idx_bundle_hash ON firmware_bundle(combination_hash);
  CREATE INDEX IF NOT EXISTS idx_device_firmware ON device_registration(firmware_id);
  CREATE INDEX IF NOT EXISTS idx_device_customer ON device_registration(customer_id);

  -- SEED DATA
  INSERT INTO firmware_type (type_name, description) 
  SELECT 'GSM', 'GSM based firmware module' WHERE NOT EXISTS (SELECT 1 FROM firmware_type WHERE type_name='GSM');
  
  INSERT INTO firmware_feature (feature_name, category) 
  SELECT 'WiFi', 'Connectivity' WHERE NOT EXISTS (SELECT 1 FROM firmware_feature WHERE feature_name='WiFi');
  
  INSERT INTO customer (customer_name) 
  SELECT 'Default Customer' WHERE NOT EXISTS (SELECT 1 FROM customer WHERE customer_name='Default Customer');
`;

async function initDB(customClient = null) {
  const client = customClient || new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    if (!customClient) await client.connect();
    await client.query(schema);
    return true;
  } catch (error) {
    console.error('[Init] Error:', error.message);
    throw error;
  } finally {
    if (!customClient) {
      try { await client.end(); } catch (e) {}
    }
  }
}

if (require.main === module) {
  initDB().catch(console.error);
}

module.exports = { initDB, schema };

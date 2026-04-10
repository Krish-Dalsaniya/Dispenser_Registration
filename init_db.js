const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: String(process.env.DB_PASS || 'root'),
  database: process.env.DB_NAME || 'dispenser_reg_db',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const schema = `
  -- ===============================
  -- 1. FIRMWARE TYPE
  -- ===============================
  CREATE TABLE IF NOT EXISTS firmware_type (
      type_id SERIAL PRIMARY KEY,
      type_name VARCHAR(100) NOT NULL,
      description TEXT
  );

  -- ===============================
  -- 2. FIRMWARE FEATURE
  -- ===============================
  CREATE TABLE IF NOT EXISTS firmware_feature (
      feature_id SERIAL PRIMARY KEY,
      feature_name VARCHAR(100) NOT NULL,
      category VARCHAR(100)
  );

  -- ===============================
  -- 3. FIRMWARE BUNDLE (CORE)
  -- ===============================
  CREATE TABLE IF NOT EXISTS firmware_bundle (
      firmware_id SERIAL PRIMARY KEY,
      combination_hash VARCHAR(255) UNIQUE NOT NULL,
      version_string VARCHAR(50),
      is_iot BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- ===============================
  -- 4. BUNDLE <-> FEATURE MAP
  -- ===============================
  CREATE TABLE IF NOT EXISTS bundle_feature_map (
      firmware_id INT NOT NULL,
      feature_id INT NOT NULL,
      PRIMARY KEY (firmware_id, feature_id),
      FOREIGN KEY (firmware_id) REFERENCES firmware_bundle(firmware_id) ON DELETE CASCADE,
      FOREIGN KEY (feature_id) REFERENCES firmware_feature(feature_id) ON DELETE CASCADE
  );

  -- ===============================
  -- 5. BUNDLE <-> TYPE MAP
  -- ===============================
  CREATE TABLE IF NOT EXISTS bundle_type_map (
      firmware_id INT NOT NULL,
      type_id INT NOT NULL,
      PRIMARY KEY (firmware_id, type_id),
      FOREIGN KEY (firmware_id) REFERENCES firmware_bundle(firmware_id) ON DELETE CASCADE,
      FOREIGN KEY (type_id) REFERENCES firmware_type(type_id) ON DELETE CASCADE
  );

  -- ===============================
  -- 6. CUSTOMER
  -- ===============================
  CREATE TABLE IF NOT EXISTS customer (
      customer_id SERIAL PRIMARY KEY,
      customer_name VARCHAR(150) NOT NULL
  );

  -- ===============================
  -- 7. DEVICE REGISTRATION (MAIN)
  -- ===============================
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

  -- ===============================
  -- 8. INDEXES (PERFORMANCE)
  -- ===============================
  CREATE INDEX IF NOT EXISTS idx_bundle_hash ON firmware_bundle(combination_hash);
  CREATE INDEX IF NOT EXISTS idx_device_firmware ON device_registration(firmware_id);
  CREATE INDEX IF NOT EXISTS idx_device_customer ON device_registration(customer_id);

  -- ===============================
  -- SEED DATA (Only if tables are empty)
  -- ===============================

  -- Using subqueries to ensure we only seed if tables are empty
  INSERT INTO firmware_type (type_name, description) 
  SELECT 'GSM', 'GSM based firmware module' WHERE NOT EXISTS (SELECT 1 FROM firmware_type);
  INSERT INTO firmware_type (type_name, description) 
  SELECT 'Motherboard', 'Main motherboard firmware' WHERE NOT EXISTS (SELECT 1 FROM firmware_type WHERE type_name='Motherboard');
  INSERT INTO firmware_type (type_name, description) 
  SELECT 'Display', 'Display controller firmware' WHERE NOT EXISTS (SELECT 1 FROM firmware_type WHERE type_name='Display');

  -- Firmware Features
  INSERT INTO firmware_feature (feature_name, category) 
  SELECT 'WiFi', 'Connectivity' WHERE NOT EXISTS (SELECT 1 FROM firmware_feature);

  -- Firmware Bundles
    ('BASIC', 'v0.9.0-STD', FALSE);

  -- Bundle-Feature Mappings
  INSERT INTO bundle_feature_map (firmware_id, feature_id) VALUES
    (1, 1), (1, 2),
    (2, 1), (2, 2), (2, 3),
    (3, 1), (3, 4), (3, 5);

  -- Bundle-Type Mappings
  INSERT INTO bundle_type_map (firmware_id, type_id) VALUES
    (1, 1),
    (2, 1), (2, 2),
    (3, 2);

  -- Customers
  INSERT INTO customer (customer_name) VALUES
    ('HP Petrol Pump'),
    ('IOCL Mumbai'),
    ('BPCL Delhi');

  -- Sample Devices
  INSERT INTO device_registration (firmware_id, customer_id, dispenser_name, pcb_id, pcb_name, mcu_id, latitude, longitude, location, fuel_type, is_iot) VALUES
    (1, 1, 'Dispenser A1', 'PCB001', 'MainBoard-V1', 'ESP32-01', '19.0760', '72.8777', 'Mumbai', 'Petrol', TRUE),
    (2, 2, 'Dispenser B2', 'PCB002', 'MainBoard-V2', 'ESP32-02', '28.7041', '77.1025', 'Delhi', 'Diesel', FALSE),
    (3, 3, 'Dispenser C3', 'PCB003', 'MainBoard-V1', 'STM32-01', '13.0827', '80.2707', 'Chennai', 'Petrol', TRUE);
`;

async function initDB() {
  try {
    await client.connect();
    console.log('✅ Connected to database.');
    await client.query(schema);
    console.log('✅ All tables created successfully.');
    console.log('✅ Seed data inserted.');
    console.log('✅ Database initialization complete!');
  } catch (error) {
    console.error('❌ Error initializing database:', error.message);
  } finally {
    await client.end();
  }
}

initDB();

-- Migration: Fix schema issues for AI Hospital database
-- Run this to update existing databases with missing tables and corrected columns

-- Update users table to include nurse role
ALTER TABLE users MODIFY COLUMN role ENUM('doctor', 'nurse', 'patient') NOT NULL;

-- Rename doctor_id to staff_id in permissions table
ALTER TABLE permissions CHANGE COLUMN doctor_id staff_id INT NOT NULL;

-- Add prescriptions table
CREATE TABLE IF NOT EXISTS prescriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    staff_id INT NOT NULL,
    medication VARCHAR(255) NOT NULL,
    dosage VARCHAR(255) NOT NULL,
    instructions TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Verify tables exist
SHOW TABLES;
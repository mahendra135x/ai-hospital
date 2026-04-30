# AI Hospital

AI Hospital is a comprehensive, full-stack healthcare management application designed to facilitate real-time patient monitoring, medical record management, and AI-driven health risk predictions. 

The system leverages a robust Node.js backend, an interactive React Native mobile app, and a Python-based Machine Learning service utilizing ensemble models (BiLSTM + Attention & XGBoost) to predict critical patient alerts.

---

## 🌟 Key Features

- **Staff & Patient Portals**: Interfaces for doctors, nurses, and patients.
- **Real-Time Vitals Monitoring**: Live syncing of patient vitals (Heart rate, SpO2, Temperature, Respiratory rate) via WebSockets.
- **AI-Powered Risk Predictions**: An advanced ML service analyzes sequences of patient vitals to calculate real-time health risk probabilities and generate automated alerts.
- **Permission & Prescription Management**: Secure role-based access control for patient data and prescription tracking.
- **Interactive Dashboards**: Mobile-friendly statistical charts and detailed views for individual patient histories.

---

## 🏗️ Architecture & Tech Stack

### 1. Database (`/database`)
- **MySQL**: Relational database storing users, patients, vitals, alerts, predictions, prescriptions, and permissions.

### 2. Backend API (`/backend`)
- **Node.js & Express**: Core REST API server.
- **Socket.IO**: For real-time bi-directional events (vitals, alerts).
- **JWT & bcryptjs**: Authentication and secure password hashing.
- **MySQL2**: Optimized Node.js driver for MySQL.

### 3. Machine Learning Service (`/ml-service`)
- **FastAPI**: High-performance HTTP server for predictive endpoints.
- **TensorFlow / Keras**: Custom Bi-Directional LSTM implementation with Attention mechanism.
- **XGBoost & Scikit-learn**: Used for ensemble meta-classification to optimize risk prediction accuracy.
- *Note: Expects an organized sequence of vitals per prediction request.*

### 4. Mobile Application (`/mobile`)
- **React Native / Expo**: Cross-platform mobile development framework.
- **React Navigation**: Intuitive multi-screen stack navigation.
- **React Native Chart Kit**: Medical and vitals data visualization.
- **Axios & Socket.io-client**: Communication with the backend and real-time streaming services.

---

## 📂 Project Structure
```text
ai-hospital/
│
├── .gitignore
├── README.md
│
├── backend/
│   ├── .env
│   ├── check_db.js
│   ├── create_test_data.js
│   ├── db.js
│   ├── generate_vitals.js
│   ├── migrate_patients.js
│   ├── package-lock.json
│   ├── package.json
│   └── server.js
│
├── database/
│   ├── init.sql
│   ├── migration_add_resp_rate.sql
│   └── migration_fix_schema.sql
│
├── ml-service/
│   ├── main.py
│   └── requirements.txt
│   └── models/               # (Directory containing .keras/.joblib model files)
│
└── mobile/
    ├── App.js
    ├── app.json
    ├── index.js
    ├── package-lock.json
    ├── package.json
    ├── assets/
    │   ├── adaptive-icon.png
    │   ├── favicon.png
    │   ├── icon.png
    │   └── splash-icon.png
    └── src/
        ├── screens/
        │   ├── AlertsScreen.js
        │   ├── DashboardScreen.js
        │   ├── LoginScreen.js
        │   ├── PatientDetailScreen.js
        │   └── PermissionsScreen.js
        └── services/
            ├── api.js
            └── socket.js

```
## 🚀 Getting Started

### Prerequisites
To run this project locally, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v16+)
- [Python](https://www.python.org/) (v3.9+)
- [MySQL Server](https://dev.mysql.com/downloads/mysql/)
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (`npm install -g expo-cli`)

- Below are the steps to run this app in your local device

### 1. Database Setup
1. Start your local MySQL server.
2. Execute the initialization script to set up the database and tables:
   ```bash
   mysql -u <your_username> -p < database/init.sql
   ```

### 2. Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables inside `backend/.env` (You may need to create this file based on existing .env.example or adjust standard variables like `DB_HOST`, `DB_USER`, `DB_PASS`, `JWT_SECRET`).
4. Start the server:
   ```bash
   npm run dev
   ```

### 3. ML Service Setup
1. Navigate to the ML service directory:
   ```bash
   cd ml-service
   ```
2. Create and activate a Virtual Environment (Optional but recommended):
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows use `venv\Scripts\activate`
   ```
3. Install required Python packages. *(Note: You may need to create a `requirements.txt` if one isn't present, but main dependencies are `fastapi`, `uvicorn`, `tensorflow`, `xgboost`, `scikit-learn`, `pandas`, `numpy`, `pydantic`)*
4. Make sure your trained model files (`bilstm_att_final.keras`, `xgb_final.joblib`, `meta_clf.joblib`, `scaler_seq.joblib`) are placed in the `ml-service/models/` folder.
5. Run the FastAPI server:
   ```bash
   python main.py
   ```
   *The service will start on `http://localhost:8000`.*

### 4. Mobile App Setup
1. Navigate to the mobile app directory:
   ```bash
   cd mobile
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Expo development server:
   ```bash
   npm start
   ```
4. Follow the Expo prompt to run the app on an Android emulator, iOS simulator, or a physical device via the Expo Go app.

---

## 🌐 Network & IP Configuration (Crucial for Local Development)

Because the mobile app runs on a physical device or an external emulator, it cannot simply use `localhost` to connect to your backend API. You MUST update the IP addresses across the project to match your development machine's local network IP (e.g., `192.168.1.x` or `10.x.x.x`):

### 1. Find Your Local IP Address
- **Windows**: Open Command Prompt and run `ipconfig`. Look for the "IPv4 Address".
- **Mac/Linux**: Open Terminal and run `ifconfig` or `ip a`. Look for the `inet` address under your active Wi-Fi or Ethernet connection.

### 2. Update the Mobile App
Change the server URLs in the mobile app's service files so they point to your local machine:
- Open `mobile/src/services/api.js` and update:
  ```javascript
  const SERVER_URL = 'http://<YOUR_IP_ADDRESS>:5000';
  ```
- Open `mobile/src/services/socket.js` and update:
  ```javascript
  const SERVER_URL = 'http://<YOUR_IP_ADDRESS>:5000';
  ```

### 3. Backend & ML Service Configuration
Your backend and ML service configuration are located in `backend/.env`:
- If you are running the backend and ML service on the **same computer**, leaving `ML_SERVICE_URL=http://localhost:8000/predict` and `DB_HOST=localhost` is perfectly fine.
- If you are running the ML service on a **different machine**, you must update `backend/.env`:
  ```env
  ML_SERVICE_URL=http://<ML_MACHINE_IP>:8000/predict
  ```

---

## 🔒 Security & Extensibility

- **Dummy Callbacks**: The ML Service has fallback mechanisms natively built-in if actual compiled `.joblib`/`.keras` models are absent, meaning the system can run seamlessly during early development.
- **Token Security**: Employs standard JWT for endpoints, meaning sensitive patient data endpoints are protected from unauthenticated access. 

---
*Created and maintained as a robust foundational prototype for forward-thinking Healthcare IT applications.*

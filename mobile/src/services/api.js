import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 10.0.2.2 points to localhost from the Android emulator. 
// Change to your machine's IP (e.g. 192.168.1.x) for physical devices.
const SERVER_URL = 'http://10.2.4.55:5000';

const api = axios.create({
  baseURL: SERVER_URL,
});

api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;

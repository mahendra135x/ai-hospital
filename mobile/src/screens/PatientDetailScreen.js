import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, ScrollView, ActivityIndicator, TouchableOpacity, Alert, Vibration } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import api from '../services/api';
import socket from '../services/socket';
import AsyncStorage from '@react-native-async-storage/async-storage';

const screenWidth = Dimensions.get('window').width;

export default function PatientDetailScreen({ route, navigation }) {
  const { patient_id, name } = route.params;
  const [vitals, setVitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentRisk, setCurrentRisk] = useState(null);
  const [prevRisk, setPrevRisk] = useState(null);

  useEffect(() => {
    // Ensure socket is connected
    if (!socket.connected) {
      console.log('Socket not connected, connecting now...');
      socket.connect();
    }
    
    fetchVitals();

    console.log(`Setting up socket listeners for patient ${patient_id}`);

    // Listen for real-time vitals
    const vitalsHandler = (data) => {
      console.log(`Received vitals for patient ${patient_id}:`, data);
      setVitals((prev) => {
        const newVitals = [data, ...prev];
        return newVitals.slice(0, 20); // Keep last 20 for graph
      });
    };

    // Listen for real-time predictions
    const predictionHandler = (data) => {
      console.log(`Received prediction for patient ${patient_id}:`, data);
      setCurrentRisk(data.risk_probability);
      // Check for high risk notification
      if (data.risk_probability > 0.6 && (prevRisk === null || prevRisk <= 0.6)) {
        // Vibrate phone
        Vibration.vibrate([0, 500, 200, 500]);
        Alert.alert('High Risk Alert', `Patient ${name} has high risk: ${(data.risk_probability * 100).toFixed(2)}%`);
      }
      setPrevRisk(data.risk_probability);
    };

    socket.on(`vitals-${patient_id}`, vitalsHandler);
    socket.on(`prediction-${patient_id}`, predictionHandler);

    return () => {
      console.log(`Cleaning up socket listeners for patient ${patient_id}`);
      socket.off(`vitals-${patient_id}`, vitalsHandler);
      socket.off(`prediction-${patient_id}`, predictionHandler);
    };
  }, [patient_id, name, prevRisk]);

  const fetchVitals = async () => {
    try {
      const response = await api.get(`/patients/${patient_id}/vitals`);
      setVitals(response.data.slice(0, 20)); // Keep last 20
    } catch (error) {
      console.error('Error fetching vitals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user_id');
    await AsyncStorage.removeItem('role');
    socket.disconnect();
    navigation.replace('Login');
  };

  const chartData = useMemo(() => {
    if (vitals.length === 0) return null;
    
    // Reverse because we prepend to array (index 0 is newest), but graph goes L to R (oldest to newest)
    const reversed = [...vitals].reverse();
    return {
      labels: reversed.map(v => new Date(v.timestamp).getSeconds().toString() + 's'),
      datasets: [
        {
          data: reversed.map(v => v.heart_rate),
          color: (opacity = 1) => `rgba(225, 29, 72, ${opacity})`, // rose-600
          strokeWidth: 2,
        },
        {
          data: reversed.map(v => v.spo2),
          color: (opacity = 1) => `rgba(56, 189, 248, ${opacity})`, // sky-400
          strokeWidth: 2,
        },
        {
          data: reversed.map(v => v.temp),
          color: (opacity = 1) => `rgba(34, 197, 94, ${opacity})`, // green-500
          strokeWidth: 2,
        },
        {
          data: reversed.map(v => v.resp_rate || 16),
          color: (opacity = 1) => `rgba(168, 85, 247, ${opacity})`, // violet-500
          strokeWidth: 2,
        }
      ],
      legend: ["Heart Rate", "SpO2", "Temperature", "Resp Rate"]
    };
  }, [vitals]);

  const renderRiskIndicator = () => {
    if (currentRisk === null) return <Text style={styles.riskLabel}>Awaiting Model...</Text>;
    
    const riskPercent = (currentRisk * 100).toFixed(2);
    let riskColor = '#22c55e'; // green
    if (currentRisk > 0.4) riskColor = '#f59e0b'; // yellow
    if (currentRisk > 0.6) riskColor = '#ef4444'; // red

    return (
      <View style={[styles.riskBox, { borderColor: riskColor }]}>
        <Text style={[styles.riskValue, { color: riskColor }]}>{riskPercent}%</Text>
        <Text style={styles.riskLabel}>ML Risk Probability</Text>
      </View>
    );
  };

  if (loading) {
    return <ActivityIndicator size="large" color="#38bdf8" style={{ flex: 1, backgroundColor: '#0f172a' }}/>;
  }

  const latestVital = vitals[0] || {};

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>{name}</Text>
      
      {/* Current Vitals Row */}
      <View style={styles.vitalsRow}>
        <View style={styles.vitalCard}>
            <Text style={styles.vitalLabel}>Heart Rate</Text>
            <Text style={styles.vitalValue}>{latestVital.heart_rate ? latestVital.heart_rate.toFixed(2) : '--'} <Text style={styles.unit}>bpm</Text></Text>
        </View>
        <View style={styles.vitalCard}>
            <Text style={styles.vitalLabel}>SpO2</Text>
            <Text style={styles.vitalValue}>{latestVital.spo2 ? latestVital.spo2.toFixed(2) : '--'} <Text style={styles.unit}>%</Text></Text>
        </View>
        <View style={styles.vitalCard}>
            <Text style={styles.vitalLabel}>Temp</Text>
            <Text style={styles.vitalValue}>{latestVital.temp ? latestVital.temp.toFixed(2) : '--'} <Text style={styles.unit}>°F</Text></Text>
        </View>
        <View style={styles.vitalCard}>
            <Text style={styles.vitalLabel}>Resp Rate</Text>
            <Text style={styles.vitalValue}>{latestVital.resp_rate !== null && latestVital.resp_rate !== undefined ? latestVital.resp_rate.toFixed(2) : '--'} <Text style={styles.unit}>breaths/min</Text></Text>
        </View>
      </View>

      {/* AI Risk Indicator */}
      <View style={styles.section}>
          {renderRiskIndicator()}
      </View>

      {/* Live Graph */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Live Trend</Text>
        {chartData ? (
          <LineChart
            data={chartData}
            width={screenWidth - 40}
            height={220}
            yAxisSuffix=""
            chartConfig={{
              backgroundColor: '#1e293b',
              backgroundGradientFrom: '#1e293b',
              backgroundGradientTo: '#1e293b',
              decimalPlaces: 2,
              color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(148, 163, 184, ${opacity})`,
              style: { borderRadius: 16 },
              propsForDots: {
                r: "3",
                strokeWidth: "1",
                stroke: "#cbd5e1"
              }
            }}
            bezier
            style={{ marginVertical: 8, borderRadius: 16 }}
          />
        ) : (
          <Text style={styles.empty}>Waiting for vitals...</Text>
        )}
      </View>

      {/* Logout Button */}
      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.permissionsBtn} onPress={() => navigation.navigate('Permissions')}>
          <Text style={styles.permissionsBtnText}>View Requests</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutBtnText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 20 },
  header: { fontSize: 26, fontWeight: '800', color: '#f8fafc', marginBottom: 20 },
  vitalsRow: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 25 },
  vitalCard: {
      backgroundColor: '#1e293b',
      borderRadius: 15,
      padding: 15,
      alignItems: 'center',
      width: '30%',
  },
  vitalLabel: { color: '#94a3b8', fontSize: 12, marginBottom: 5 },
  vitalValue: { color: '#fff', fontSize: 22, fontWeight: 'bold' },
  unit: { fontSize: 12, color: '#64748b' },
  section: { backgroundColor: '#1e293b', borderRadius: 15, padding: 20, marginBottom: 20 },
  sectionTitle: { color: '#f8fafc', fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  riskBox: { alignItems: 'center', padding: 15, borderRadius: 10, borderWidth: 2, backgroundColor: '#0f172a' },
  riskValue: { fontSize: 40, fontWeight: 'bold' },
  riskLabel: { color: '#94a3b8', fontSize: 14, marginTop: 5 },
  buttonRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  permissionsBtn: { flex: 1, backgroundColor: '#3b82f6', padding: 15, borderRadius: 10, alignItems: 'center' },
  permissionsBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  logoutBtn: { flex: 1, backgroundColor: '#64748b', padding: 15, borderRadius: 10, alignItems: 'center' },
  logoutBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  empty: { color: '#64748b', textAlign: 'center' }
});

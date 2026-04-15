import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import api from '../services/api';
import socket from '../services/socket';

export default function AlertsScreen() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAlerts();

    socket.on('staff-alert', (data) => {
        setAlerts(prev => [data, ...prev]);
    });

    return () => socket.off('staff-alert');
  }, []);

  const fetchAlerts = async () => {
    try {
      const response = await api.get('/alerts');
      setAlerts(response.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }) => {
      const isCritical = item.severity === 'critical';
      const color = isCritical ? '#dc2626' : '#ea580c'; // Red vs Orange
      return (
        <View style={[styles.card, { borderLeftColor: color }]}>
          <Text style={styles.patientName}>{item.patient_name}</Text>
          <Text style={styles.message}>{item.message}</Text>
          {item.location_lat != null && item.location_lon != null && (
            <Text style={styles.location}>Location: {item.location_lat}, {item.location_lon}</Text>
          )}
          <View style={[styles.badge, { backgroundColor: color }]}>
              <Text style={styles.severity}>{item.severity}</Text>
          </View>
        </View>
      );
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color="#38bdf8" />
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={(item, index) => item.id ? item.id.toString() : index.toString()}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 20 }}
          ListEmptyComponent={<Text style={styles.empty}>No alerts recenty.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 20,
  },
  card: {
    backgroundColor: '#1e293b',
    padding: 20,
    borderRadius: 12,
    marginBottom: 15,
    borderLeftWidth: 5,
  },
  patientName: {
    color: '#e2e8f0',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  message: {
    color: '#cbd5e1',
    fontSize: 15,
    marginBottom: 10,
  },
  location: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 10,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  severity: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  empty: {
    color: '#64748b',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
  }
});

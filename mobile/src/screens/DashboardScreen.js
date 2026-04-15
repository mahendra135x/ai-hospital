import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import socket from '../services/socket';

export default function DashboardScreen({ navigation }) {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  useEffect(() => {
    fetchPatients();

    // Listen for global doctor alerts
    socket.on('doctor-alert', (data) => {
      // We could show an in-app toast here
      console.log("Global Alert:", data);
    });

    // Set header right buttons
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', marginRight: 10 }}>
          <TouchableOpacity style={styles.alertBtn} onPress={() => navigation.navigate('Alerts')}>
            <Text style={styles.alertBtnText}>Alerts</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutBtnText}>Logout</Text>
          </TouchableOpacity>
        </View>
      ),
    });

    return () => {
      socket.off('doctor-alert');
    }
  }, [navigation]);

  const fetchPatients = async () => {
    try {
      const response = await api.get('/patients');
      setPatients(response.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    const trimmedQuery = query.trim();
    if (trimmedQuery.length >= 2) {
      try {
        const response = await api.get(`/patients/search?q=${encodeURIComponent(trimmedQuery)}`);
        setSearchResults(response.data);
      } catch (error) {
        console.error(error);
        Alert.alert('Search Error', 'Unable to search patients. Please try again.');
        setSearchResults([]);
      }
    } else {
      setSearchResults([]);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user_id');
    await AsyncStorage.removeItem('role');
    socket.disconnect();
    navigation.replace('Login');
  };

  const sendRequest = async (patient_id) => {
    try {
      await api.post('/permissions', { patient_id });
      Alert.alert('Success', 'Request sent to patient');
      setSearchResults([]); // Clear search after sending
      setSearchQuery('');
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || error.message);
    }
  };

  const renderPatientItem = ({ item }) => {
    const isApproved = item.permission_status === 'approved';
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.name}>{item.name}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>ID: {item.patient_id}</Text>
          </View>
        </View>
        <Text style={styles.email}>{item.email}</Text>
        {isApproved ? (
          <TouchableOpacity
            style={styles.viewButton}
            onPress={() => navigation.navigate('PatientDetail', { patient_id: item.patient_id, name: item.name })}
          >
            <Text style={styles.viewButtonText}>View Details</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.requestButton} onPress={() => sendRequest(item.patient_id)}>
            <Text style={styles.requestButtonText}>Send Request</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderSearchItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.name}>{item.name}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>ID: {item.patient_id}</Text>
        </View>
      </View>
      <Text style={styles.email}>{item.email}</Text>
      <TouchableOpacity style={styles.requestButton} onPress={() => sendRequest(item.patient_id)}>
        <Text style={styles.requestButtonText}>Send Request</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder="Search patients by name or email"
        value={searchQuery}
        onChangeText={handleSearch}
      />

      {searchQuery ? (
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.patient_id.toString()}
          renderItem={renderSearchItem}
          ListEmptyComponent={<Text style={styles.emptyText}>No patients found</Text>}
        />
      ) : (
        <FlatList
          data={patients}
          keyExtractor={(item) => item.patient_id.toString()}
          renderItem={renderPatientItem}
          ListEmptyComponent={<Text style={styles.emptyText}>No patients found</Text>}
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
  alertBtn: {
    backgroundColor: '#e11d48',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 10,
  },
  alertBtnText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  logoutBtn: {
    backgroundColor: '#64748b',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
  logoutBtnText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  searchInput: {
    backgroundColor: '#1e293b',
    color: '#e2e8f0',
    padding: 10,
    borderRadius: 8,
    marginBottom: 20,
    fontSize: 16,
  },
  card: {
    backgroundColor: '#1e293b',
    padding: 20,
    borderRadius: 15,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#38bdf8',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e2e8f0',
  },
  email: {
    fontSize: 14,
    color: '#94a3b8',
  },
  badge: {
    backgroundColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: 'bold',
  },
  requestButton: {
    backgroundColor: '#10b981',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
    alignItems: 'center',
  },
  requestButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  viewButton: {
    backgroundColor: '#3b82f6',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
    alignItems: 'center',
  },
  viewButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748b',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
  },
});

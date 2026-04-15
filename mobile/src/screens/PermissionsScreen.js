import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import api from '../services/api';

export default function PermissionsScreen() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    try {
      const response = await api.get('/permissions/pending');
      setRequests(response.data);
    } catch (error) {
      console.error('Error fetching permissions:', error);
      Alert.alert('Error', 'Failed to fetch permission requests');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      await api.put(`/permissions/${id}`, { status: 'approved' });
      Alert.alert('Success', 'Permission approved');
      fetchPermissions();
    } catch (error) {
      Alert.alert('Error', 'Failed to approve permission');
    }
  };

  const handleDeny = async (id) => {
    try {
      await api.put(`/permissions/${id}`, { status: 'revoked' });
      Alert.alert('Success', 'Permission denied');
      fetchPermissions();
    } catch (error) {
      Alert.alert('Error', 'Failed to deny permission');
    }
  };

  const renderItem = ({ item }) => {
    const createdDate = new Date(item.created_at).toLocaleDateString();
    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <View>
            <Text style={styles.doctorName}>{item.name}</Text>
            <Text style={styles.email}>{item.email}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Pending</Text>
          </View>
        </View>
        <Text style={styles.date}>Requested: {createdDate}</Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, styles.approveBtn]}
            onPress={() => handleApprove(item.id)}
          >
            <Text style={styles.buttonText}>Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.denyBtn]}
            onPress={() => handleDeny(item.id)}
          >
            <Text style={styles.buttonText}>Deny</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#38bdf8" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {requests.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No pending permission requests</Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#1e293b',
    padding: 20,
    borderRadius: 15,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#38bdf8',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  doctorName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e2e8f0',
    marginBottom: 5,
  },
  email: {
    fontSize: 14,
    color: '#94a3b8',
  },
  badge: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  date: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 15,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  approveBtn: {
    backgroundColor: '#10b981',
  },
  denyBtn: {
    backgroundColor: '#ef4444',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 16,
  },
});

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import socket from '../services/socket';

export default function LoginScreen({ navigation }) {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('patient'); // 'doctor' or 'patient'
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    if (!email || !password || (!isLogin && !name)) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }
    
    setLoading(true);
    try {
      if (!isLogin) {
        // Register flow
        await api.post('/auth/register', { role, name, email, password });
        Alert.alert('Success', 'Account created! Please log in.');
        setIsLogin(true); // Switch to login screen after successful registration
      } else {
        // Login flow
        const response = await api.post('/auth/login', { role, email, password });
        await AsyncStorage.setItem('token', response.data.token);
        await AsyncStorage.setItem('user_id', response.data.id.toString());
        await AsyncStorage.setItem('role', response.data.role);
        
        socket.connect();
        
        if(response.data.role === 'doctor'){
          navigation.replace('Dashboard');
        } else {
          navigation.replace('PatientDetail', { patient_id: response.data.patient_id, name: response.data.name });
        }
      }
    } catch (error) {
      Alert.alert('Authentication Failed', error.response?.data?.error || error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>AI Hospital</Text>
        <Text style={styles.subtitle}>{isLogin ? 'Sign in to continue' : 'Create a new account'}</Text>
        
        <View style={styles.roleContainer}>
           <TouchableOpacity 
             style={[styles.roleBtn, role === 'patient' && styles.roleBtnActive]}
             onPress={() => setRole('patient')}
           >
               <Text style={[styles.roleText, role === 'patient' && styles.roleTextActive]}>Patient</Text>
           </TouchableOpacity>
           <TouchableOpacity 
             style={[styles.roleBtn, role === 'doctor' && styles.roleBtnActive]}
             onPress={() => setRole('doctor')}
           >
               <Text style={[styles.roleText, role === 'doctor' && styles.roleTextActive]}>Doctor</Text>
           </TouchableOpacity>
        </View>

        {!isLogin && (
          <TextInput
            style={styles.input}
            placeholder="Full Name"
            placeholderTextColor="#888"
            value={name}
            onChangeText={setName}
          />
        )}
        
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#888"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#888"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity style={styles.button} onPress={handleAuth} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{isLogin ? 'LOGIN' : 'REGISTER'}</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.switchButton} onPress={() => setIsLogin(!isLogin)}>
            <Text style={styles.switchText}>
                {isLogin ? "Don't have an account? Register" : "Already have an account? Log in"}
            </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#1e293b',
    padding: 30,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#38bdf8',
    textAlign: 'center',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 20,
  },
  roleContainer: {
    flexDirection: 'row',
    marginBottom: 15,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
    minHeight: 50, // ensures visibility
  },
  roleBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  roleBtnActive: {
    backgroundColor: '#38bdf8',
  },
  roleText: {
    color: '#94a3b8',
    fontWeight: 'bold',
  },
  roleTextActive: {
    color: '#0f172a',
  },
  input: {
    backgroundColor: '#0f172a',
    color: '#fff',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginBottom: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  button: {
    backgroundColor: '#0284c7',
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  switchButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  switchText: {
      color: '#38bdf8',
      fontSize: 14,
  }
});

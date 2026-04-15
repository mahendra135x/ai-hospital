import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import PatientDetailScreen from './src/screens/PatientDetailScreen';
import AlertsScreen from './src/screens/AlertsScreen';
import PermissionsScreen from './src/screens/PermissionsScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName="Login"
        screenOptions={{
          headerStyle: { backgroundColor: '#1a1a2e' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
          contentStyle: { backgroundColor: '#16213e' }
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Doctor Dashboard' }} />
        <Stack.Screen name="PatientDetail" component={PatientDetailScreen} options={{ title: 'Patient Details' }} />
        <Stack.Screen name="Alerts" component={AlertsScreen} options={{ title: 'Recent Alerts' }} />
        <Stack.Screen name="Permissions" component={PermissionsScreen} options={{ title: 'Permission Requests' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

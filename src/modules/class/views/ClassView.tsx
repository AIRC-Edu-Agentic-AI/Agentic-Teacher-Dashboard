import React from 'react';
import NotificationManager from '../components/NotificationManager';
import AttendanceDashboard from '../components/AttendanceDashboard';

export const ClassView = () => {
  return (
    <div style={{ padding: '24px', backgroundColor: '#f4f6f8', minHeight: '100vh' }}>
      <h1 style={{ marginBottom: '24px', color: '#2c3e50', fontSize: '28px' }}>
        Class & Teaching Management
      </h1>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <AttendanceDashboard />
        <NotificationManager />
      </div>
    </div>
  );
};
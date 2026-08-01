'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getApiUrl } from '../utils/api';

let socketInstance: Socket | null = null;

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(socketInstance);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('gravityx_token') : null;

    if (!socketInstance) {
      socketInstance = io(getApiUrl(), {
        auth: { token },
        transports: ['polling', 'websocket'],
        extraHeaders: {
          'Bypass-Tunnel-Reminder': 'true',
          'ngrok-skip-browser-warning': 'true',
        },
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      });


      socketInstance.on('connect', () => {
        console.log('Socket connected successfully:', socketInstance?.id);
      });

      socketInstance.on('disconnect', () => {
        console.log('Socket disconnected');
      });

      socketInstance.on('connect_error', (err) => {
        console.error('Socket connect error:', err.message);
      });
    } else {
      // If socket already exists, verify that the token matches
      if (socketInstance.auth && (socketInstance.auth as any).token !== token) {
        (socketInstance.auth as any).token = token;
        if (socketInstance.connected) {
          socketInstance.disconnect().connect();
        }
      }
    }

    setSocket(socketInstance);
  }, []);

  // Sync socket auth dynamically on custom updates (login/logout/token updates)
  useEffect(() => {
    const handleAuthSync = () => {
      const token = localStorage.getItem('gravityx_token');
      if (socketInstance) {
        if (socketInstance.auth && (socketInstance.auth as any).token !== token) {
          (socketInstance.auth as any).token = token;
          socketInstance.disconnect().connect();
          console.log('🔄 [SOCKET AUTH SYNC]: Updated handshake token and reconnected socket.');
        }
      }
    };

    window.addEventListener('gravityx_user_updated', handleAuthSync);
    window.addEventListener('storage', handleAuthSync);

    return () => {
      window.removeEventListener('gravityx_user_updated', handleAuthSync);
      window.removeEventListener('storage', handleAuthSync);
    };
  }, []);

  return socket;
}


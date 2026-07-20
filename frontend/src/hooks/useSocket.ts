'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { getApiUrl } from '../utils/api';

let socketInstance: Socket | null = null;

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!socketInstance) {
      const token = typeof window !== 'undefined' ? localStorage.getItem('gravityx_token') : null;
      socketInstance = io(getApiUrl(), {
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
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
    }

    socketRef.current = socketInstance;

    return () => {
      // We keep socketInstance alive across pages to avoid connecting/disconnecting repeatedly
    };
  }, []);

  return socketRef.current || socketInstance;
}

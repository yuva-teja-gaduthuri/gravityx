'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getApiUrl } from '../utils/api';

let socketInstance: Socket | null = null;

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(socketInstance);

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

    setSocket(socketInstance);
  }, []);

  return socket;
}

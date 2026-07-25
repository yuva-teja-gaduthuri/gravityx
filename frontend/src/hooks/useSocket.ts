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
    } else {
      // If the socket connection already exists, check if the token has been updated
      const currentAuthToken = (socketInstance.auth as any)?.token;
      if (token && currentAuthToken !== token) {
        (socketInstance.auth as any).token = token;
        socketInstance.disconnect().connect();
        console.log('Socket reconnected with updated auth token');
      }
    }

    setSocket(socketInstance);
  }, []);

  return socket;
}

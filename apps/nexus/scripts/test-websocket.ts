/**
 * WebSocket Connection Test Script
 *
 * Tests the agent WebSocket gateway by:
 * 1. Getting a JWT token via /auth/token
 * 2. Connecting to the WebSocket gateway
 * 3. Sending a heartbeat
 * 4. Disconnecting
 *
 * Usage:
 *   npx ts-node scripts/test-websocket.ts
 */

import { io, Socket } from 'socket.io-client';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Credentials from seed script (update if re-seeded)
const CLIENT_ID = process.env.CLIENT_ID || 'agent_64a2a5d08522a51a271b43c6a2301e43';
const CLIENT_SECRET =
  process.env.CLIENT_SECRET ||
  'secret_40b49b5965d594515a8185f44e98afe9cb7458f9e5ac3906a7b2459306cdb7f9';

async function getToken(): Promise<string> {
  console.log('1. Getting JWT token...');

  const response = await fetch(`${BASE_URL}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });

  if (!response.ok) {
    throw new Error(`Auth failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  console.log(`   Token received (expires in ${data.expires_in}s)`);
  return data.access_token;
}

async function testWebSocket(token: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log('\n2. Connecting to WebSocket...');

    const socket: Socket = io(`${BASE_URL}/agents`, {
      query: { token },
      transports: ['websocket'],
    });

    // Connection successful
    socket.on('connect', () => {
      console.log(`   Connected! Socket ID: ${socket.id}`);
    });

    // Welcome message from server
    socket.on('connected', (data) => {
      console.log(`   Server says: ${data.message}`);
      console.log(`   Agent ID: ${data.agentId}`);

      // Send heartbeat
      console.log('\n3. Sending heartbeat...');
      socket.emit(
        'heartbeat',
        {
          type: 'heartbeat',
          payload: { ping: true },
          timestamp: new Date().toISOString(),
        },
        (response: unknown) => {
          console.log('   Heartbeat response:', JSON.stringify(response, null, 2));

          // Send agent_ready
          console.log('\n4. Sending agent_ready...');
          socket.emit(
            'agent_ready',
            {
              type: 'agent_ready',
              payload: { capabilities: ['test'], version: '1.0.0' },
              timestamp: new Date().toISOString(),
            },
            (readyResponse: unknown) => {
              console.log('   Agent ready response:', JSON.stringify(readyResponse, null, 2));

              // Disconnect
              console.log('\n5. Disconnecting...');
              socket.disconnect();
              resolve();
            },
          );
        },
      );
    });

    // Connection error
    socket.on('connect_error', (error) => {
      console.error(`   Connection error: ${error.message}`);
      reject(error);
    });

    // Disconnected
    socket.on('disconnect', (reason) => {
      console.log(`   Disconnected: ${reason}`);
    });

    // Timeout
    setTimeout(() => {
      if (socket.connected) {
        socket.disconnect();
      }
      reject(new Error('Test timeout'));
    }, 10000);
  });
}

async function main() {
  console.log('='.repeat(60));
  console.log('WebSocket Gateway Test');
  console.log('='.repeat(60));
  console.log(`Server: ${BASE_URL}`);
  console.log(`Client ID: ${CLIENT_ID}\n`);

  try {
    const token = await getToken();
    await testWebSocket(token);
    console.log('\n' + '='.repeat(60));
    console.log('All tests passed!');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('\nTest failed:', error);
    process.exit(1);
  }
}

main();

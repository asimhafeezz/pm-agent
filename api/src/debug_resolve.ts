import fetch from 'node-fetch';

const API_URL = 'http://localhost:6000';

async function testResolve() {
  console.log('--- Testing Resolve for TSLA ---');
  try {
    const res = await fetch(`${API_URL}/api/instruments/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol: 'TSLA' })
    });
    const data = await res.json();
    console.log('Resolve Response:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Error:', e);
  }
}

testResolve();

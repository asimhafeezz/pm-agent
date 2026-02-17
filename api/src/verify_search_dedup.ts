import fetch from 'node-fetch';

const API_URL = 'http://localhost:6000';

async function testDedup() {
  console.log('--- Testing Deduplication ---');
  
  const runSearch = async (query: string, assetType: string = '') => {
      console.log(`\n🔍 Searching for "${query}" [AssetType: ${assetType || 'ALL'}]...`);
      try {
        const url = `${API_URL}/api/instruments/search?query=${query}${assetType ? `&assetType=${assetType}` : ''}`;
        const searchRes = await fetch(url);
        if (!searchRes.ok) throw new Error(searchRes.statusText);
        const response = await searchRes.json();
        const data = response.data || response;
        
        if (Array.isArray(data)) {
             console.log(`✅ Found ${data.length} results.`);
             const symbols = data.map((i: any) => `${i.symbol} (${i.exchange})`);
             console.log('   Results:', symbols.slice(0, 10));
             
             // Check for duplicates
             const unique = new Set(data.map((i: any) => i.symbol));
             if (unique.size !== data.length) {
                 console.error('❌ Duplicates found!');
             } else {
                 console.log('✅ No duplicates found.');
             }
        }
      } catch (e) {
        console.error('❌ Search failed:', e);
      }
  };

  await runSearch('TSLA', 'STOCK');
  await runSearch('BTC', 'CRYPTO');
}

testDedup();

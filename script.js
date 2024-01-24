async function getGroup(groupSlug, apiKey) {
  const response = await fetch(`https://api.manifold.markets/v0/group/${groupSlug}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Key ${apiKey}`
    },
    timeout: 10000
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch group: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

async function searchMarkets(limit, groupId, before, apiKey) {
  const params = new URLSearchParams();
  params.set('limit', limit);
  params.set('groupId', groupId);
  if (before) {
    params.set('before', before);
  }

  const response = await fetch(`https://api.manifold.markets/v0/markets?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Key ${apiKey}`
    },
    timeout: 10000
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch markets: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

async function groupMarket(marketId, groupId, remove, apiKey) {
  const payload = {
    groupId: groupId
  };

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Key ${apiKey}`
  };

  if (remove) {
    payload.remove = true;
    console.log(`Removing group ${groupId} from market ${marketId}...`);
  } else {
    console.log(`Adding group ${groupId} to market ${marketId}...`);
  }

  const response = await fetch(`https://api.manifold.markets/v0/market/${marketId}/group`, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(payload),
    timeout: 10000
  });

  if (!response.ok) {
    throw new Error(`Failed to group market: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

async function replaceGroup(oldTag, newTag, apiKey) {
  const oldGroup = await getGroup(oldTag, apiKey);
  const newGroup = await getGroup(newTag, apiKey);
  const oldGroupId = oldGroup.id;
  const newGroupId = newGroup.id;

  let migrationFinished = false;
  let before = null;

  // Create an array to store the market information
  const marketInfo = [];

  while (!migrationFinished) {
    const markets = await searchMarkets(400, oldGroupId, before, apiKey);
    before = markets[markets.length - 1].id;

    const tasks = [];
    for (const market of markets) {
      tasks.push(groupMarket(market.id, newGroupId, false, apiKey));
      tasks.push(groupMarket(market.id, oldGroupId, true, apiKey));
    }

    await Promise.all(tasks);

    // Check if the market has been updated with its groups
    const updatedMarkets = await searchMarkets(400, newGroupId, before, apiKey);
    const updatedMarketIds = updatedMarkets.map(market => market.id);

    for (const market of markets) {
      // Check if the market has been updated
      const isUpdated = updatedMarketIds.includes(market.id);

      // Store the market information in the array
      marketInfo.push({
        id: market.id,
        question: market.question,
        url: market.url,
        updated: isUpdated ? 'Yes' : 'No'
      });
    }

    if (markets.length < 400) {
      console.log("Finished migrating markets!");
      migrationFinished = true;
      break;
    }

    console.log("Sleeping for 60 seconds...");
    await sleep(60000);
  }
  
  // Output the table of market information
  console.table(marketInfo, ['id', 'question', 'url', 'updated']);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function replaceGroups() {
  const apiKey = document.getElementById("apiKey").value;
  const oldGroupSlug = document.getElementById("oldGroupSlug").value;
  const newGroupSlug = document.getElementById("newGroupSlug").value;

  replaceGroup(oldGroupSlug, newGroupSlug, apiKey)
    .then(() => {
      console.log("Groups replaced successfully!");
    })
    .catch(error => {
      console.error("An error occurred while replacing groups:", error);
    });
}

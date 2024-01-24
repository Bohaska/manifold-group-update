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

  const tableBody = document.getElementById('market-table-body');
  const progressRow = createTableRow('...', '...', '...', 'In Progress...');
  tableBody.appendChild(progressRow);

  let migrationFinished = false;
  let before = null;

  while (!migrationFinished) {
    const markets = await searchMarkets(400, oldGroupId, before, apiKey);
    before = markets[markets.length - 1].id;

    const tasks = [];
    for (const market of markets) {
      tableBody.appendChild(createTableRow(market.id, market.question, market.url, 'In Progress...'));
      tasks.push(
        groupMarket(market.id, newGroupId, false, apiKey)
          .catch(() => { /* Ignore errors */ })
      );
      tasks.push(
        groupMarket(market.id, oldGroupId, true, apiKey)
          .catch(() => { /* Ignore errors */ })
      );
    }

    await Promise.all(tasks);

    for (const market of markets) {
      // Check if the market has been updated
      const isUpdated = tasks.some(task => task.marketId === market.id && task.status === 'fulfilled');

      // Create a new row with market information
      const newRow = createTableRow(market.id, market.question, market.url, isUpdated ? 'Yes' : 'No');

      // Replace the existing row with the new row
      const existingRow = document.getElementById(market.id);
      existingRow.parentNode.replaceChild(newRow, existingRow);
    }

    if (markets.length < 400) {
      document.getElementById("...").parentNode.replaceChild(createTableRow("...", "...", "...", "Finished"), document.getElementById("..."))
      console.log("Finished migrating markets!");
      migrationFinished = true;
      break;
    }

    console.log("Sleeping for 60 seconds...");
    await sleep(60000);
  }

  // Update the progress row with the final status
  progressRow.cells[3].textContent = marketInfo.length > 1 ? (marketInfo[marketInfo.length - 1].updated === 'Yes' ? 'Yes' : 'Failed') : 'No';
}

function createTableRow(id, question, url, updated) {
  const row = document.createElement('tr');
  row.id = id;
  const idCell = document.createElement('td');
  idCell.textContent = id;
  const questionCell = document.createElement('td');
  questionCell.textContent = question;
  const urlCell = document.createElement('td');
  urlCell.textContent = url;
  const updatedCell = document.createElement('td');
  updatedCell.textContent = updated;
  row.appendChild(idCell);
  row.appendChild(questionCell);
  row.appendChild(urlCell);
  row.appendChild(updatedCell);
  return row;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

import './style.css';
import { Peer } from 'peerjs';

// DOM Elements
const myPeerIdElement = document.getElementById('my-peer-id');
const manualPeerIdInput = document.getElementById('manual-peer-id');
const connectButton = document.getElementById('connect-button');
const connectErrorElement = document.getElementById('connect-error');
const peersSection = document.getElementById('peers-section');
const peersList = document.getElementById('peers-list');
const peersCount = document.getElementById('peers-count');
const dropArea = document.getElementById('drop-area');
const fileInput = document.getElementById('file-input');
const browseButton = document.getElementById('browse-button');
const selectedFilesSection = document.getElementById('selected-files-section');
const selectedFilesList = document.getElementById('selected-files-list');
const transferProgressSection = document.getElementById('transfer-progress-section');
const transferType = document.getElementById('transfer-type');
const fileName = document.getElementById('file-name');
const progressBar = document.getElementById('progress-bar');
const progressPercentage = document.getElementById('progress-percentage');
const statusIndicator = document.createElement('div');

// Add status indicator to header
const headerContent = document.querySelector('.header-content');
statusIndicator.className = 'status-indicator';
statusIndicator.innerHTML = '<span class="status-text">Ready to share</span>';
headerContent.appendChild(statusIndicator);

// State
let myPeerId = '';
let peers = [];
let selectedFiles = [];
let transferProgress = 0;
let isReceiving = false;
let receivingFileName = '';
let scanning = false; // Set to false to disable automatic scanning
let peerInstance = null;
let chunks = [];

// Helper Functions
function generateShortId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function updatePeersCount() {
  peersCount.textContent = `${peers.length} device(s) found`;
  if (peers.length > 0) {
    peersSection.classList.remove('hidden');
  } else {
    peersSection.classList.add('hidden');
  }
}

function updateSelectedFilesUI() {
  if (selectedFiles.length > 0) {
    selectedFilesSection.classList.remove('hidden');
    selectedFilesList.innerHTML = '';
    
    selectedFiles.forEach((file, index) => {
      const fileItem = document.createElement('div');
      fileItem.className = 'file-item';
      
      const fileNameElement = document.createElement('span');
      fileNameElement.className = 'file-name';
      fileNameElement.textContent = file.name;
      
      const fileSizeElement = document.createElement('span');
      fileSizeElement.className = 'file-size';
      fileSizeElement.textContent = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;
      
      fileItem.appendChild(fileNameElement);
      fileItem.appendChild(fileSizeElement);
      selectedFilesList.appendChild(fileItem);
    });
  } else {
    selectedFilesSection.classList.add('hidden');
  }
}

function updateTransferProgressUI() {
  if (transferProgress > 0 || isReceiving) {
    transferProgressSection.classList.remove('hidden');
    transferType.textContent = isReceiving ? 'Receiving File...' : 'Sending File...';
    
    if (isReceiving) {
      fileName.textContent = `Receiving: ${receivingFileName}`;
      updateStatusIndicator('receiving');
    } else if (transferProgress > 0) {
      updateStatusIndicator('sending');
    }
    
    progressBar.style.width = `${transferProgress}%`;
    progressPercentage.textContent = `${Math.round(transferProgress)}%`;
  } else {
    transferProgressSection.classList.add('hidden');
    updateStatusIndicator('ready');
  }
}

function updateStatusIndicator(status) {
  statusIndicator.className = 'status-indicator';
  
  switch(status) {
    case 'sending':
      statusIndicator.classList.add('sending');
      statusIndicator.innerHTML = '<span class="status-text">Sending file...</span>';
      break;
    case 'receiving':
      statusIndicator.classList.add('receiving');
      statusIndicator.innerHTML = '<span class="status-text">Receiving file...</span>';
      break;
    case 'connected':
      statusIndicator.classList.add('connected');
      statusIndicator.innerHTML = '<span class="status-text">Connected</span>';
      break;
    default:
      statusIndicator.classList.add('ready');
      statusIndicator.innerHTML = '<span class="status-text">Ready to share</span>';
  }
}

function renderPeersList() {
  peersList.innerHTML = '';
  
  peers.forEach(peer => {
    const peerItem = document.createElement('div');
    peerItem.className = 'peer-item';
    
    const peerIdText = document.createElement('span');
    peerIdText.className = 'peer-id-text';
    peerIdText.textContent = peer.id;
    
    const peerActions = document.createElement('div');
    peerActions.className = 'peer-actions';
    
    const sendButton = document.createElement('button');
    sendButton.className = 'button primary-button';
    sendButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
      <span>Send</span>
    `;
    sendButton.disabled = selectedFiles.length === 0;
    sendButton.addEventListener('click', () => {
      selectedFiles.forEach(file => sendFile(file, peer.id));
    });
    
    peerActions.appendChild(sendButton);
    peerItem.appendChild(peerIdText);
    peerItem.appendChild(peerActions);
    peersList.appendChild(peerItem);
  });
  
  updatePeersCount();
}

// PeerJS Setup
function initializePeer() {
  const shortId = generateShortId();
  const peer = new Peer(shortId, {
    debug: 0, // Set debug level to 0 to suppress most logs
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' },
      ],
    },
  });
  
  peerInstance = peer;
  
  peer.on('open', (id) => {
    console.log('My peer ID is:', id);
    myPeerId = id;
    myPeerIdElement.textContent = id;
    // Don't start scanning automatically
  });
  
  peer.on('connection', (conn) => {
    console.log('Incoming connection from:', conn.peer);
    
    conn.on('data', handleIncomingData);
    
    const existingPeerIndex = peers.findIndex(p => p.id === conn.peer);
    if (existingPeerIndex === -1) {
      peers.push({ id: conn.peer, connection: conn, lastSeen: Date.now() });
    } else {
      peers[existingPeerIndex].connection = conn;
      peers[existingPeerIndex].lastSeen = Date.now();
    }
    
    updateStatusIndicator('connected');
    renderPeersList();
  });
  
  peer.on('error', (err) => {
    // Only log critical errors, ignore peer-unavailable errors during scanning
    if (err.type !== 'peer-unavailable') {
      console.error('Peer error:', err);
    }
  });
}

function connectToPeer() {
  if (!manualPeerIdInput.value || manualPeerIdInput.value.length !== 4) {
    connectErrorElement.textContent = 'Please enter a valid 4-character Peer ID';
    return;
  }
  
  const targetPeerId = manualPeerIdInput.value;
  
  try {
    const conn = peerInstance?.connect(targetPeerId, {
      reliable: true,
      metadata: { sender: myPeerId }
    });
    
    if (conn) {
      conn.on('open', () => {
        console.log('Connected to:', targetPeerId);
        conn.on('data', handleIncomingData);
        
        const existingPeerIndex = peers.findIndex(p => p.id === targetPeerId);
        if (existingPeerIndex === -1) {
          peers.push({ id: targetPeerId, connection: conn, lastSeen: Date.now() });
        } else {
          peers[existingPeerIndex].connection = conn;
          peers[existingPeerIndex].lastSeen = Date.now();
        }
        
        updateStatusIndicator('connected');
        renderPeersList();
        manualPeerIdInput.value = '';
        connectErrorElement.textContent = '';
      });
      
      conn.on('error', (err) => {
        console.error('Connection error:', err);
        connectErrorElement.textContent = 'Failed to connect. Please check the Peer ID and try again.';
      });
    }
  } catch (error) {
    console.error('Connection error:', error);
    connectErrorElement.textContent = 'Failed to connect. Please check the Peer ID and try again.';
  }
}

// File Transfer Functions
async function sendFile(file, peerId) {
  const peer = peers.find(p => p.id === peerId);
  if (!peer?.connection) return;
  
  const chunkSize = 64000;
  const totalChunks = Math.ceil(file.size / chunkSize);
  
  peer.connection.send({
    type: 'file-start',
    fileName: file.name,
    totalChunks,
  });
  
  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const chunk = await file.slice(start, end).arrayBuffer();
    
    peer.connection.send({
      type: 'file-chunk',
      chunk,
      totalChunks,
    });
    
    transferProgress = ((i + 1) / totalChunks) * 100;
    updateTransferProgressUI();
  }
  
  peer.connection.send({
    type: 'file-end',
    fileName: file.name,
  });
  
  setTimeout(() => {
    transferProgress = 0;
    updateTransferProgressUI();
  }, 1000); // Keep the progress bar visible for a moment after completion
}

function handleIncomingData(data) {
  if (data.type === 'file-start') {
    isReceiving = true;
    receivingFileName = data.fileName;
    chunks = [];
    updateTransferProgressUI();
  } else if (data.type === 'file-chunk') {
    chunks.push(data.chunk);
    transferProgress = Math.min((chunks.length / data.totalChunks) * 100, 100);
    updateTransferProgressUI();
  } else if (data.type === 'file-end') {
    const blob = new Blob(chunks);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = data.fileName;
    a.click();
    URL.revokeObjectURL(url);
    
    setTimeout(() => {
      isReceiving = false;
      transferProgress = 0;
      chunks = [];
      updateTransferProgressUI();
    }, 1000); // Keep the progress bar visible for a moment after completion
  }
}

// Event Listeners
connectButton.addEventListener('click', connectToPeer);

manualPeerIdInput.addEventListener('input', (e) => {
  manualPeerIdInput.value = e.target.value.toUpperCase();
  connectErrorElement.textContent = '';
});

browseButton.addEventListener('click', () => {
  fileInput.click();
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files && e.target.files.length > 0) {
    selectedFiles = Array.from(e.target.files);
    updateSelectedFilesUI();
    renderPeersList(); // Update send buttons state
    
    // Add animation for file selection
    dropArea.classList.add('files-selected');
    setTimeout(() => {
      dropArea.classList.remove('files-selected');
    }, 1000);
  }
});

// Drag and Drop
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
  dropArea.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
  }, false);
});

['dragenter', 'dragover'].forEach(eventName => {
  dropArea.addEventListener(eventName, () => {
    dropArea.classList.add('active');
  }, false);
});

['dragleave', 'drop'].forEach(eventName => {
  dropArea.addEventListener(eventName, () => {
    dropArea.classList.remove('active');
  }, false);
});

dropArea.addEventListener('drop', (e) => {
  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    selectedFiles = Array.from(e.dataTransfer.files);
    updateSelectedFilesUI();
    renderPeersList(); // Update send buttons state
    
    // Add animation for file drop
    dropArea.classList.add('files-selected');
    setTimeout(() => {
      dropArea.classList.remove('files-selected');
    }, 1000);
  }
}, false);

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initializePeer();
});
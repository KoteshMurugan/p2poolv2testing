import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import BlockchainView from './components/BlockchainView';
import WorkersTable from './components/WorkersTable';
import SharesTable from './components/SharesTable';
import RocksDBViewer from './components/RocksDBViewer';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/blockchain" element={<BlockchainView />} />
          <Route path="/workers" element={<WorkersTable />} />
          <Route path="/shares" element={<SharesTable />} />
          <Route path="/database" element={<RocksDBViewer />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;


import './App.css'

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.tsx';
import Dashboard from './components/Dashboard.tsx';
import BlockchainView from './components/BlockchainView.tsx';
import WorkersTable from './components/WorkersTable.tsx';
import SharesTable from './components/SharesTable.tsx';
import RocksDBViewer from './components/RocksDBViewer.tsx';

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

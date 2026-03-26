import React, { useState } from 'react';
import { FaEye } from 'react-icons/fa';
import { useQuery } from '@tanstack/react-query';
import Filter from '../../../../Component/Filter/Filter';
import PaginatedTable from '../../../../Component/PaginatedTable/PaginatedTable';
import Modal from '../../../../Component/Modal/Modal';
import SearchBar from '../../../../Component/SearchBar/SearchBar';
import ActionDropdown from '../../../../Component/ActionDropdown/ActionDropdown';
import Loader from '../../../../Component/Loader/Loader'; 
import { fetchBookLog } from '../../../../../Api/api';
import '../../../../Component/MainContent/MainContent.css';
import '../../../../Component/ActionDropdown/ActionDropdown.css';
import '../../../../Component/Modal/Modal.css';
import '../../../../Component/Filter/Filter.css';
import '../../../../Component/SearchBar/SearchBar.css';

const BooknPayLog = () => {
  const [searchKey, setSearchKey] = useState('');
  const [selectedActionType, setSelectedActionType] = useState('All');
  const [appliedFilters, setAppliedFilters] = useState({ actionType: 'All' });
  const [selectedLog, setSelectedLog] = useState(null);

  // Get userid from localStorage
  const userid = localStorage.getItem('userid');

const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';

    let date;

    // 1. FIX FOR OWNER DATA: (Format: DD/MM/YYYY HH:mm:ss)
    // We manually convert "26/02/2026 14:00:00" into a format the browser can read
    if (typeof timestamp === 'string' && timestamp.includes('/')) {
        const [datePart, timePart] = timestamp.split(' ');
        const [day, month, year] = datePart.split('/');
        // Create a standard format: YYYY-MM-DDTHH:mm:ss
        date = new Date(`${year}-${month}-${day}T${timePart}`);
    } 
    // 2. FIX FOR ADMIN DATA: (Format: YYYY-MM-DD HH:mm:ss)
    else {
        date = new Date(timestamp);
    }

    // 3. DISPLAY FORMATTING: Use 'UTC' to prevent double-shifting
    // Your backend already added the 8 hours in the database.
    if (isNaN(date.getTime())) return timestamp; 

    return date.toLocaleString('en-MY', {
      timeZone: 'UTC', // Forces the browser to show exactly what is in the DB
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };
  
  // Replace useEffect with React Query
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['bookLogs', userid],
    queryFn: () => fetchBookLog(userid),
    enabled: !!userid, 
    onError: (error) => {
      console.error('Failed to fetch Book & Pay Logs:', error);
    },
    staleTime: 5 * 60 * 1000, 
  });

  const handleApplyFilters = () => {
    setAppliedFilters({ actionType: selectedActionType });
  };

  const filters = [
    {
      name: 'actionType',
      label: 'Action Type',
      value: selectedActionType,
      onChange: setSelectedActionType,
      options: [
        { value: 'All', label: 'All Actions' },
        { value: 'Create', label: 'Create' },
        { value: 'Request', label: 'Request' },
        { value: 'Payment', label: 'Payment' },
        { value: 'Update', label: 'Update' },
        { value: 'Delete', label: 'Delete' }, // Owner-specific filter preserved
      ],
    },
  ];

  const displayLabels = {
    username: 'Actioned By',
    timestamp: 'Timestamp',
    action: 'Action',
  };

  const filteredLogs = logs.filter((log) => {
    const searchInFields = `${log.userid} ${log.action}`
      .toLowerCase()
      .includes(searchKey.toLowerCase());

    const actionFilter =
      appliedFilters.actionType === 'All' ||
      log.action.toLowerCase().includes(appliedFilters.actionType.toLowerCase());

    return searchInFields && actionFilter;
  });

  const handleAction = (action, log) => {
    if (action === 'view') {
      const essentialFields = {
        userid: log.userid || 'N/A',
        timestamp: formatTimestamp(log.timestamp), // Formatted for Modal
        action: log.action || 'N/A',
        username: log.username || 'N/A',
      };
      setSelectedLog(essentialFields);
    }
  };

  const logDropdownItems = [
    { label: 'View Details', icon: <FaEye />, action: 'view' },
  ];

  const columns = [
    { 
      header: 'Timestamp', 
      accessor: 'timestamp',
      render: (log) => formatTimestamp(log.timestamp) // Formatted for Table
    },
    { header: 'Action', accessor: 'action' },
    { header: 'Actioned By', accessor: 'username' },
    {
      header: 'Actions',
      accessor: 'actions',
      render: (log) => (
        <ActionDropdown
          items={logDropdownItems}
          onAction={(action) => handleAction(action, log)}
          onClose={() => {}}
        />
      ),
    },
  ];

  return (
    <div>
      <div className="header-container">
        <h1 className="dashboard-page-title">Book & Pay Log</h1>
        <SearchBar
          value={searchKey}
          onChange={(newValue) => setSearchKey(newValue)}
          placeholder="Search logs..."
        />
      </div>

      <Filter filters={filters} onApplyFilters={handleApplyFilters} />

      {isLoading ? (
        <div className="loader-box">
          <Loader />
        </div>
      ) : (
        <PaginatedTable
          data={filteredLogs}
          columns={columns}
          rowKey={(log) => `${log.timestamp}-${log.userid}`}
          enableCheckbox={false}
        />
      )}

      <Modal
        isOpen={!!selectedLog}
        title="Log Details"
        data={selectedLog || {}}
        labels={displayLabels}
        onClose={() => setSelectedLog(null)}
      />
    </div>
  );
};

export default BooknPayLog;
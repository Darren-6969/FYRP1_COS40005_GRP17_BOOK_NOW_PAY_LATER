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

  // Helper to convert DB timestamp to local Malaysia time
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    // Fallback to raw string if date is invalid, otherwise format it
    return isNaN(date.getTime()) ? timestamp : date.toLocaleString('en-MY', {
      timeZone: 'Asia/Kuala_Lumpur',
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
    enabled: !!userid, // Only run query if userid exists
    onError: (error) => {
      console.error('Failed to fetch Book & Pay Logs:', error);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
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
        timestamp: formatTimestamp(log.timestamp), // Updated to use formatted time
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
      render: (log) => formatTimestamp(log.timestamp) // Updated to render formatted time in the table
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
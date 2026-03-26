import React, { useState } from 'react';
import { FaEye } from 'react-icons/fa';
import { useQuery } from '@tanstack/react-query';
import Filter from '../../../../Component/Filter/Filter';
import PaginatedTable from '../../../../Component/PaginatedTable/PaginatedTable';
import Modal from '../../../../Component/Modal/Modal';
import SearchBar from '../../../../Component/SearchBar/SearchBar';
import ActionDropdown from '../../../../Component/ActionDropdown/ActionDropdown';
import Loader from '../../../../Component/Loader/Loader';
import { auditTrails } from '../../../../../Api/api';
import '../../../../Component/MainContent/MainContent.css';
import '../../../../Component/ActionDropdown/ActionDropdown.css';
import '../../../../Component/Modal/Modal.css';
import '../../../../Component/Filter/Filter.css';
import '../../../../Component/SearchBar/SearchBar.css';

const AuditTrails = () => {
  const [searchKey, setSearchKey] = useState('');
  const [selectedActionType, setSelectedActionType] = useState('All');
  const [appliedFilters, setAppliedFilters] = useState({ actionType: 'All' });
  const [selectedLog, setSelectedLog] = useState(null);

  const userid = localStorage.getItem('userid');

  // Replace useEffect with React Query
  const { data: auditTrailsLog = [], isLoading } = useQuery({
    queryKey: ['auditTrails', userid],
    queryFn: () => auditTrails(userid),
    onError: (error) => {
      console.error('Failed to fetch Audit Trails Logs:', error);
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
        { value: 'Accept', label: 'Accept' },
        { value: 'Reject', label: 'Reject' },
        { value: 'Create', label: 'Create' },
        { value: 'Update', label: 'Update' },
        { value: 'Delete', label: 'Delete' },
        { value: 'Assign', label: 'Assign' },
        { value: 'Request', label: 'Request' },
        { value: 'Register', label: 'Register'},
        { value: 'Login', label: 'Login' },
        { value: 'Logout', label: 'Logout' },
        { value: 'Suggest', label: 'Suggest' },
        { value: 'Notify', label: 'Notify' },

      ],
    },
  ];

  const displayLabels = {
    audittrailid: 'Audit Trail ID',
    entityid: 'Entity ID',
    entitytype: 'Entity Type',
    timestamp: 'Timestamp',
    action: 'Action',
    actiontype: 'Action Type',
    creatorid: 'Creator ID',
    actionedby: 'Actioned By',
  };

  const filteredLogs = auditTrailsLog.filter((log) => {
    const searchInFields = `${log.userid} ${log.entityid} ${log.actiontype} ${log.action} ${log.username}`
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
        creatorid: log.userid || 'N/A',
        actionedby: log.username || 'N/A',
        entityid: log.entityid || 'N/A',
        entitytype: log.entitytype || 'N/A',
        timestamp: log.timestamp || 'N/A',
        action: log.action || 'N/A',
        actiontype: log.actiontype || 'N/A',
      };
      setSelectedLog(essentialFields);
    }
  };

  const logDropdownItems = [
    { label: 'View Details', icon: <FaEye />, action: 'view' },
  ];

  const columns = [
    {
      header: 'Entity[Entity ID]',
      accessor: 'entityInfo',
      render: (log) => `${log.entitytype}[${log.entityid}]`,
    },
    { header: 'Action', accessor: 'action' },
    { header: 'Actioned By', accessor: 'username' },
    { header: 'Timestamp', accessor: 'timestamp' },
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
        <h1 className="dashboard-page-title">Audit Trails</h1>
        <SearchBar
          value={searchKey}
          onChange={(newValue) => setSearchKey(newValue)}
          placeholder="Search audit trail..."
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
          rowKey={(log) => `${log.timestamp}-${log.audittrailid}`}
          enableCheckbox={false}
        />
      )}

      <Modal
        isOpen={!!selectedLog}
        title="Audit Trail Details"
        data={selectedLog || {}}
        labels={displayLabels}
        onClose={() => setSelectedLog(null)}
      />
    </div>
  );
};

export default AuditTrails;

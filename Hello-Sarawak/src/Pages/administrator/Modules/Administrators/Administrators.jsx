import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAdministrators } from '../../../../../Api/api';
import Filter from '../../../../Component/Filter/Filter';
import ActionDropdown from '../../../../Component/ActionDropdown/ActionDropdown';
import Modal from '../../../../Component/Modal/Modal';
import SearchBar from '../../../../Component/SearchBar/SearchBar';
import PaginatedTable from '../../../../Component/PaginatedTable/PaginatedTable';
import Loader from '../../../../Component/Loader/Loader';
import Status from '../../../../Component/Status/Status';
import UserActivityCell from '../../../../Component/UserActivityCell/UserActivityCell';
import { FaEye } from 'react-icons/fa';
import '../../../../Component/MainContent/MainContent.css';
import '../../../../Component/ActionDropdown/ActionDropdown.css';
import '../../../../Component/Modal/Modal.css';
import '../../../../Component/Filter/Filter.css';
import '../../../../Component/SearchBar/SearchBar.css';
import './Administrator.css';


const Administrators = () => {
  const [searchKey, setSearchKey] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [appliedFilters, setAppliedFilters] = useState({ status: 'All' });
  const [selectedOperator, setSelectedOperator] = useState(null);

  // Fetch administrators using React Query
  const { data: administrator = [], isLoading, error } = useQuery({
    queryKey: ['administrators'],
    queryFn: fetchAdministrators,
    staleTime: 30 * 60 * 1000,
    refetchInterval: 1000,
  });

  const handleApplyFilters = () => {
    setAppliedFilters({ status: selectedStatus });
  };

  const filters = [
    {
      name: 'status',
      label: 'Status',
      value: selectedStatus,
      onChange: setSelectedStatus,
      options: [
        { value: 'All', label: 'All Statuses' },
        { value: 'Active', label: 'Active' },
        { value: 'Inactive', label: 'Inactive' },
      ],
    },
  ];

  const displayLabels = {
    userid: 'UID',
    ufirstname: 'First Name',
    ulastname: 'Last Name',
    uemail: 'Email',
    uphoneno: 'Phone Number',
    uactivation: 'Status',
    ugender: 'Gender',
    ucountry: 'Country',
    ustatus: 'Login Status'
  };

  // Filtering users based on search key and status
  const filteredUsers = administrator.filter((administrator) => {
    const searchInFields =
      `${administrator.userid} ${administrator.ufirstname} ${administrator.ulastname} ${administrator.uemail} ${administrator.uphoneno} ${administrator.uactivation}`
        .toLowerCase()
        .includes(searchKey.toLowerCase());

    const statusFilter =
      appliedFilters.status === 'All' || administrator.uactivation === appliedFilters.status;

    return searchInFields && statusFilter;
  });

  const handleAction = (action, administrator) => {
    if (action === 'view') {
      const essentialFields = {
        userid: administrator.userid || 'N/A',
        username: administrator.username || 'N/A',
        ufirstname: administrator.ufirstname || 'N/A',
        ulastname: administrator.ulastname || 'N/A',
        uemail: administrator.uemail || 'N/A',
        uphoneno: administrator.uphoneno || 'N/A',
        uactivation: administrator.uactivation || 'N/A',
        ugender: administrator.ugender || 'N/A',
        ucountry: administrator.ucountry || 'N/A',
        ustatus: administrator.ustatus || 'N/A',
      };
      setSelectedOperator(essentialFields);
    }
  };

  const operatorDropdownItems = [{ label: 'View Details', icon: <FaEye />, action: 'view' }];

  const columns = [
    { header: 'UID', accessor: 'userid' },
    {
      header: 'Username',
      accessor: 'administrator',
      render: (administrator) => (
        <UserActivityCell user={administrator} />
      ),
    },
    {
      header: 'Name',
      accessor: 'name',
      render: (administrator) => (
          `${administrator.ufirstname.trim()} ${administrator.ulastname.trim()}`
      ),
  },
    { header: 'Email', accessor: 'uemail' },
    {
      header: 'Status',
      accessor: 'uactivation',
      render: (administrator) => (
        <Status value={administrator.uactivation || 'Active'} />
      ),
    },
    {
      header: 'Actions',
      accessor: 'actions',
      render: (operator) => (
        <ActionDropdown
          items={operatorDropdownItems}
          onAction={(action) => handleAction(action, operator)}
          onClose={() => {}}
        />
      ),
    },
  ];

  return (
    <div>
      <div className="header-container">
        <h1 className="dashboard-page-title">Administrator Details</h1>
        <SearchBar
          value={searchKey}
          onChange={(newValue) => setSearchKey(newValue)}
          placeholder="Search administrators ..."
        />
      </div>

      <Filter filters={filters} onApplyFilters={handleApplyFilters} />

      {isLoading ? (
        <div className="loader-box">
          <Loader />
        </div>
      ) : error ? (
        <p className="error-message">Failed to load administrators: {error.message}</p>
      ) : (
        <PaginatedTable data={filteredUsers} columns={columns} rowKey="userid" enableCheckbox={false} />
      )}

      <Modal
        isOpen={!!selectedOperator}
        title={'Administrator Details'}
        data={selectedOperator || {}}
        labels={displayLabels}
        onClose={() => setSelectedOperator(null)}
      />
    </div>
  );
};

export default Administrators;

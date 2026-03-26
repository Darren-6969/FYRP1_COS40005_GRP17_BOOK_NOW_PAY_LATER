import React, { useState, useEffect } from 'react';
import { fetchOperators, assignRole, fetchClusters, updateUser } from '../../../../../Api/api';
import Filter from '../../../../Component/Filter/Filter';
import ActionDropdown from '../../../../Component/ActionDropdown/ActionDropdown';
import Modal from '../../../../Component/Modal/Modal';
import SearchBar from '../../../../Component/SearchBar/SearchBar';
import PaginatedTable from '../../../../Component/PaginatedTable/PaginatedTable';
import Toast from '../../../../Component/Toast/Toast';
import Role from '../../../../Component/Role/Role';
import RoleManager from '../../../../Component/RoleManager/RoleManager';
import UserActivityCell from '../../../../Component/UserActivityCell/UserActivityCell';
import Alert from '../../../../Component/Alert/Alert';
import { FaEye, FaUserTag, FaEdit } from 'react-icons/fa';
import '../../../../Component/MainContent/MainContent.css';
import '../../../../Component/ActionDropdown/ActionDropdown.css';
import '../../../../Component/Modal/Modal.css';
import '../../../../Component/Filter/Filter.css';
import '../../../../Component/SearchBar/SearchBar.css';
import '../Operators/Operators.css';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Loader from '../../../../Component/Loader/Loader';


const Operators = () => {
  const [searchKey, setSearchKey] = useState('');
  const [selectedRole, setSelectedRole] = useState('All');
  const [appliedFilters, setAppliedFilters] = useState({ role: 'All' });
  const [selectedOperator, setSelectedOperator] = useState(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [roleOperator, setRoleOperator] = useState(null);
  const [selectedAssignRole, setSelectedAssignRole] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastType, setToastType] = useState('');
  const [showClusterModal, setShowClusterModal] = useState(false);
  const [clusterOperator, setClusterOperator] = useState(null);
  const [selectedCluster, setSelectedCluster] = useState('');
  const [availableClusters, setAvailableClusters] = useState([]);
  const API_URL = import.meta.env.VITE_API_URL;
  
  const queryClient = useQueryClient();
  const roles = ['Customer', 'Moderator', 'Administrator'];

  // Get all cluster data
  useEffect(() => {
    const loadClusters = async () => {
      try {
        const clusterData = await fetchClusters();
        setAvailableClusters(clusterData);
      } catch (error) {
        console.error("Error fetching clusters:", error);
        displayToast('error', 'Failed to load clusters');
      }
    };
    
    loadClusters();
  }, []);

  const displayToast = (type, message) => {
    setToastType(type);
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 5000);
  };

  // Fetch operators with TanStack Query
  const { 
    data: operators = [], 
    isLoading, 
    isError, 
    error 
  } = useQuery({
    queryKey: ['operators'],
    queryFn: async () => {
      try {
        try {
          // First, get all operators
          const operators = await fetchOperators();
          
          // Get all clusters
          const clusters = await fetchClusters();
          
          // Add cluster information to operator data
          const operatorsWithClusters = operators.map(operator => {
            // Handle possible different field names
            const operatorClusterId = operator.clusterid || operator.cluster_id || operator.cluster || '';
            
            if (operatorClusterId) {
              // Attempt to match clusterid in different formats (number or string)
              const matchingCluster = clusters.find(cluster => {
                const clusterId = cluster.clusterid || cluster.cluster_id || cluster.id;
                return clusterId && (clusterId.toString() === operatorClusterId.toString());
              });
              
              if (matchingCluster) {
                const clusterName = matchingCluster.clustername || matchingCluster.cluster_name || matchingCluster.name;
                return {
                  ...operator,
                  clusterid: operatorClusterId, // Unified field name
                  clustername: clusterName // Unified field name
                };
              }
            }
            
            // If no matching cluster is found, ensure standard format is returned
            return {
              ...operator,
              clusterid: operatorClusterId || '',
              clustername: ''
            };
          });
          
          console.log("Processed operators with clusters:", operatorsWithClusters);
          return operatorsWithClusters;
        } catch (error) {
          console.error('API error:', error);
          throw error;
        }
      } catch (error) {
        throw new Error('Failed to fetch operator details');
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    onError: (error) => {
      displayToast('error', `Failed to fetch operators: ${error.message}`);
    }
  });

  // Role assignment mutation
  const assignRoleMutation = useMutation({
    mutationFn: ({ userId, role }) => assignRole(userId, role),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries(['operators']);
      setShowRoleModal(false);
      displayToast(
        'success',
        `Successfully assigned ${variables.role} role to ${roleOperator.username}`
      );
    },
    onError: (error) => {
      displayToast('error', `Error assigning role: ${error.message}`);
    }
  });

  // Edit operator cluster mutation
  const updateClusterMutation = useMutation({
    mutationFn: ({ userData, userid }) => updateUser(userData, userid),
    onSuccess: () => {
      
      queryClient.invalidateQueries(['operators']);
      queryClient.invalidateQueries(['clusters']);
      
      setShowClusterModal(false);
      displayToast(
        'success',
        `Successfully updated cluster for ${clusterOperator.username}`
      );
    },
    onError: (error) => {
      displayToast('error', `Error updating cluster: ${error.message}`);
    }
  });

  const handleApplyFilters = () => {
    setAppliedFilters({ role: selectedRole });
  };

  const filters = [
    {
      name: 'role',
      label: 'Role',
      value: selectedRole,
      onChange: setSelectedRole,
      options: [
        { value: 'All', label: 'All Roles' },
        { value: 'Administrator', label: 'Administrator' },
        { value: 'Moderator', label: 'Moderator' },
      ],
    },
  ];

  const displayLabels = {
    ufirstname: 'First Name',
    ulastname: 'Last Name',
    uemail: 'Email',
    uphoneno: 'Phone Number',
    usergroup: 'Role',
    ugender: 'Gender',
    ucountry: 'Country',
    clusterid: 'Cluster ID',
    clustername: 'Cluster Name'
  };

  const filteredOperators = operators.filter((operator) => {
    const searchInFields =
      `${operator.ufirstname || ''} ${operator.ulastname || ''} ${operator.uemail || ''} ${operator.uphoneno || ''} ${operator.usergroup || ''} ${operator.clustername || ''}`
        .toLowerCase()
        .includes(searchKey.toLowerCase());

    const roleFilter =
      appliedFilters.role === 'All' || operator.usergroup === appliedFilters.role;

    return searchInFields && roleFilter;
  });

  const handleAction = (action, operator) => {
    if (action === 'view') {
      const essentialFields = {
        ufirstname: operator.ufirstname || 'N/A',
        ulastname: operator.ulastname || 'N/A',
        uemail: operator.uemail || 'N/A',
        uphoneno: operator.uphoneno || 'N/A',
        usergroup: operator.usergroup || 'N/A',
        ugender: operator.ugender || 'N/A',
        ucountry: operator.ucountry || 'N/A',
        clusterid: operator.clusterid || 'N/A',
        clustername: operator.clustername || 'N/A'
      };
      setSelectedOperator(essentialFields);
    } else if (action === 'assignRole') {
      setRoleOperator(operator);
      setSelectedAssignRole(operator.usergroup || 'Moderator'); 
      setShowRoleModal(true);
    } else if (action === 'editCluster') {
      setClusterOperator(operator);
      setSelectedCluster(operator.clusterid || '');
      setShowClusterModal(true);
    }
  };

  const handleRoleChange = (e) => {
    setSelectedAssignRole(e.target.value);
  };

  const handleClusterChange = (e) => {
    setSelectedCluster(e.target.value);
  };

  const handleRoleSubmit = () => {
    if (!roleOperator || !selectedAssignRole) return;
    
    assignRoleMutation.mutate({
      userId: roleOperator.userid,
      role: selectedAssignRole
    });
  };

  const handleClusterSubmit = () => {
    if (!clusterOperator) return;

    const userData = { 
      clusterid: selectedCluster || null,  
      username: clusterOperator.username || 'user_' + clusterOperator.userid,
      firstName: clusterOperator.ufirstname,
      lastName: clusterOperator.ulastname,
      email: clusterOperator.uemail,
      phoneNo: clusterOperator.uphoneno,
      country: clusterOperator.ucountry,
      zipCode: clusterOperator.uzipcode,
      creatorid: localStorage.getItem("userid"),
      creatorUsername: localStorage.getItem("username")
    };
    
    
    // Ensure the user ID is valid
    if (!clusterOperator.userid) {
      displayToast('error', 'Invalid operator ID');
      return;
    }
    
    updateClusterMutation.mutate({
      userData: userData,
      userid: clusterOperator.userid
    }, {
      onError: (error) => {
        // Additional error handling to capture more detailed error information
        console.error('Detailed update error:', error);
        // Attempt to extract more error information
        const errorMessage = error.message || 'Unknown error occurred';
        displayToast('error', `Error updating cluster: ${errorMessage}`);
      }
    });
  };

  const operatorDropdownItems = [
    { label: 'View Operator', icon: <FaEye />, action: 'view' },
    { label: 'Assign Role', icon: <FaUserTag />, action: 'assignRole' },
    { label: 'Edit Cluster', icon: <FaEdit />, action: 'editCluster' },
  ];

  const columns = [
    { header: 'ID', accessor: 'userid' },
    {
      header: 'Username',
      accessor: 'operator',
      render: (operator) => (
        <UserActivityCell user={operator} />
      ),
    },
    {
      header: 'Name',
      accessor: 'name',
      render: (operator) => (
          `${operator.ufirstname.trim()} ${operator.ulastname.trim()}`
      ),
  },
    { header: 'Email', accessor: 'uemail' },
    {
      header: 'Role',
      accessor: 'usergroup',
      render: (operator) => (
        <Role role={operator.usergroup || 'Operator'} />
      ),
    },
    {
      header: 'Cluster',
      accessor: 'clustername',
      render: (operator) => {
        const clusterName = operator.clustername || 
                            (operator.clusterid ? `ID: ${operator.clusterid}` : 'N/A');
        return <span>{clusterName}</span>;
      },
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

  useEffect(() => {
    if (operators.length > 0) {

      if (clusterOperator) {
        const updatedOperator = operators.find(op => op.userid === clusterOperator.userid);
        if (updatedOperator) {
          console.log("Updated operator cluster info:", {
            userid: updatedOperator.userid,
            username: updatedOperator.username,
            clusterid: updatedOperator.clusterid,
            clustername: updatedOperator.clustername
          });
        }
      }
    }
  }, [operators, clusterOperator]);

  return (
    <div>
      {showToast && <Toast type={toastType} message={toastMessage} />}
      
      <div className="header-container">
        <h1 className="dashboard-page-title">Operator Details</h1>
        <SearchBar
          value={searchKey}
          onChange={(newValue) => setSearchKey(newValue)}
          placeholder="Search operators..."
        />
      </div>

      <Filter filters={filters} onApplyFilters={handleApplyFilters} />

      {isLoading && (
        <div className="loader-box">
          <Loader />
        </div>
      )}
      
      {isError && (
        <Alert type="error" message={`Error: ${error.message || 'Failed to load operators'}`} />
      )}

      {!isLoading && !isError && (
        <PaginatedTable
          data={filteredOperators}
          columns={columns}
          rowKey="userid"
          enableCheckbox={false}
        />
      )}

      <Modal
        isOpen={!!selectedOperator}
        title={`${selectedOperator?.ufirstname} ${selectedOperator?.ulastname}`}
        data={selectedOperator || {}}
        labels={displayLabels}
        onClose={() => setSelectedOperator(null)}
      />
      
      <RoleManager
        isOpen={showRoleModal}
        user={roleOperator}
        roles={roles}
        selectedRole={selectedAssignRole} 
        onRoleChange={handleRoleChange}
        onSubmit={handleRoleSubmit}
        onClose={() => setShowRoleModal(false)}
        isLoading={assignRoleMutation.isPending}
      />

      {/* Modal window for editing clusters */}
      {showClusterModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h2>Edit Cluster Assignment</h2>
              <button className="close-button" onClick={() => setShowClusterModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <h3>Assign cluster for Selected Operator</h3>
              <div className="form-group">
                <label htmlFor="cluster-select">Select Cluster:</label>
                <select
                  id="cluster-select"
                  value={selectedCluster}
                  onChange={handleClusterChange}
                  className="form-control"
                >
                  <option value="">No Cluster</option>
                  {availableClusters.map(cluster => {
                    // Ensure we use the string format of the ID
                    const clusterId = cluster.clusterid ? cluster.clusterid.toString() : '';
                    const clusterName = cluster.clustername || `Cluster ${clusterId}`;
                    return (
                      <option key={clusterId} value={clusterId}>
                        {clusterName}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <div className="button-group">
                <button
                  className="submit-button"
                  onClick={handleClusterSubmit}
                  disabled={updateClusterMutation.isPending}
                >
                  {updateClusterMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  className="cancel-button"
                  onClick={() => setShowClusterModal(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Operators;

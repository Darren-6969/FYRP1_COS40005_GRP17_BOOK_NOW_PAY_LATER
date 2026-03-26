import React, { useState, useEffect, useCallback } from 'react';
import { 
  fetchClusters, 
  fetchClusterNames, 
  addCluster, 
  updateCluster, 
  deleteCluster 
} from '../../../../../Api/api';
import Filter from '../../../../Component/Filter/Filter';
import ActionDropdown from '../../../../Component/ActionDropdown/ActionDropdown';
import Modal from '../../../../Component/Modal/Modal';
import SearchBar from '../../../../Component/SearchBar/SearchBar';
import PaginatedTable from '../../../../Component/PaginatedTable/PaginatedTable';
import Toast from '../../../../Component/Toast/Toast';
import Alert from '../../../../Component/Alert/Alert';
import Loader from '../../../../Component/Loader/Loader';
import { FaEye, FaEdit, FaTrash } from 'react-icons/fa';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import '../../../../Component/MainContent/MainContent.css';
import '../../../../Component/ActionDropdown/ActionDropdown.css';
import '../../../../Component/Modal/Modal.css';
import '../../../../Component/Filter/Filter.css';
import '../../../../Component/SearchBar/SearchBar.css';
import './Cluster.css';

const Cluster = () => {
  const [searchKey, setSearchKey] = useState('');
  const [selectedState, setSelectedState] = useState('All');
  const [appliedFilters, setAppliedFilters] = useState({ state: 'All' });
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCluster, setNewCluster] = useState({
    clusterName: '',
    clusterState: '',
    clusterProvince: ''
  });
  const [editMode, setEditMode] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastType, setToastType] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [clusterToDelete, setClusterToDelete] = useState(null);

  const queryClient = useQueryClient();

  const displayToast = (type, message) => {
    setToastType(type);
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 5000);
  };

  // Fetch clusters with TanStack Query
  const { 
    data: clusters = [], 
    isLoading: clustersLoading, 
    isError: clustersError, 
    error: clustersErrorMessage 
  } = useQuery({
    queryKey: ['clusters'],
    queryFn: fetchClusters,
    staleTime: 5 * 60 * 1000, // 5 minutes
    onError: (error) => {
      displayToast('error', `Failed to fetch clusters: ${error.message}`);
    }
  });

  // Fetch cluster names for filter
  const { 
    data: states = [], 
    isLoading: statesLoading 
  } = useQuery({
    queryKey: ['clusterNames'],
    queryFn: fetchClusterNames,
    staleTime: 5 * 60 * 1000, // 5 minutes
    onError: (error) => {
      displayToast('error', `Failed to fetch cluster names: ${error.message}`);
    }
  });

  // Add cluster mutation
  const addClusterMutation = useMutation({
    mutationFn: addCluster,
    onSuccess: (data) => {
      queryClient.invalidateQueries(['clusters']);
      queryClient.invalidateQueries(['clusterNames']);
      setShowAddModal(false);
      resetForm();
      displayToast('success', `Successfully added ${newCluster.clusterName}`);
    },
    onError: (error) => {
      displayToast('error', `Error adding cluster: ${error.message}`);
    }
  });

  // Update cluster mutation
  const updateClusterMutation = useMutation({
    mutationFn: ({ clusterID, clusterData }) => updateCluster(clusterID, clusterData),
    onSuccess: () => {
      queryClient.invalidateQueries(['clusters']);
      queryClient.invalidateQueries(['clusterNames']);
      setShowAddModal(false);
      resetForm();
      displayToast('success', `Successfully updated ${newCluster.clusterName}`);
    },
    onError: (error) => {
      displayToast('error', `Error updating cluster: ${error.message}`);
    }
  });

  // Delete cluster mutation
  const deleteClusterMutation = useMutation({
    mutationFn: deleteCluster,
    onSuccess: (data, clusterID) => {
      queryClient.invalidateQueries(['clusters']);
      queryClient.invalidateQueries(['clusterNames']);
      const cluster = clusters.find(c => c.clusterid === clusterID);
      if (cluster) {
        displayToast('success', `Cluster ${cluster.clustername} deleted successfully.`);
      }
      setIsDialogOpen(false);
      setClusterToDelete(null);
    },
    onError: (error) => {
      displayToast('error', `Error deleting cluster: ${error.message}`);
      setIsDialogOpen(false);
      setClusterToDelete(null);
    }
  });

  const resetForm = useCallback(() => {
    setNewCluster({
      clusterName: '',
      clusterState: '',
      clusterProvince: ''
    });
    setEditMode(false);
  }, []);

  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setNewCluster(prev => ({
      ...prev,
      [name]: value
    }));
  }, []);

  const handleSearchChange = useCallback((newValue) => {
    setSearchKey(newValue);
  }, []);

  const handleDeleteCluster = useCallback(async (cluster) => {
    setClusterToDelete(cluster);
    setIsDialogOpen(true);
  }, []);

  const handleAction = useCallback((action, cluster) => {
    if (action === 'view') {
      setSelectedCluster(cluster);
    } else if (action === 'edit') {
      setNewCluster({
        clusterID: cluster.clusterid,
        clusterName: cluster.clustername,
        clusterState: cluster.clusterstate,
        clusterProvince: cluster.clusterprovince
      });
      setEditMode(true);
      setShowAddModal(true);
    } else if (action === 'delete') {
      handleDeleteCluster(cluster);
    }
  }, [handleDeleteCluster]);

  const handleAddCluster = useCallback(async () => {
    const clusterData = {
      clusterName: newCluster.clusterName,
      clusterState: newCluster.clusterState,
      clusterProvince: newCluster.clusterProvince
    };
    
    if (editMode) {
      updateClusterMutation.mutate({
        clusterID: newCluster.clusterID,
        clusterData
      });
    } else {
      addClusterMutation.mutate(clusterData);
    }
  }, [newCluster, editMode, addClusterMutation, updateClusterMutation]);

  const handleApplyFilters = () => {
    setAppliedFilters({ state: selectedState });
  };

  const filters = [
    {
      name: 'state',
      label: 'Cluster Name',
      value: selectedState,
      onChange: setSelectedState,
      options: [
        { value: 'All', label: 'All Cluster Names' },
        ...states.map(state => (
          typeof state === 'string' 
            ? { value: state, label: state } 
            : { value: state.clustername, label: state.clustername }
        ))
      ],
    },
  ];

  const displayLabels = {
    clusterid: 'ID',
    clustername: 'Name',
    clusterstate: 'State',
    clusterprovince: 'Province',
    // timestamp: 'Created At'
  };

  const filteredClusters = clusters.filter((cluster) => {
    const searchInFields =
      `${cluster.clustername} ${cluster.clusterstate} ${cluster.clusterprovince}`
        .toLowerCase()
        .includes(searchKey.toLowerCase());

    const stateFilter =
      appliedFilters.state === 'All' || cluster.clustername === appliedFilters.state;

    return searchInFields && stateFilter;
  });

  const clusterDropdownItems = [
    { label: 'View Details', icon: <FaEye />, action: 'view' },
    { label: 'Edit Cluster', icon: <FaEdit />, action: 'edit' },
    { label: 'Delete Cluster', icon: <FaTrash />, action: 'delete' },
  ];

  const columns = [
    { header: 'ID', accessor: 'clusterid' },
    { header: 'Name', accessor: 'clustername' },
    { header: 'State', accessor: 'clusterstate' },
    { header: 'Province', accessor: 'clusterprovince' },
    // { 
    //   header: 'Created At', 
    //   accessor: 'timestamp',
    //   render: (cluster) => {
    //     const date = new Date(cluster.timestamp);
    //     return isNaN(date) ? 'N/A' : date.toLocaleString();
    //   }
    // },
    {
      header: 'Actions',
      accessor: 'actions',
      render: (cluster) => (
        <ActionDropdown
          items={clusterDropdownItems}
          onAction={(action) => handleAction(action, cluster)}
          onClose={() => {}}
        />
      ),
    },
  ];

  const AddClusterModal = React.memo(({ isOpen, onClose }) => {
    if (!isOpen) return null;
    
    const [localFormData, setLocalFormData] = useState(() => ({
      clusterName: newCluster.clusterName,
      clusterState: newCluster.clusterState,
      clusterProvince: newCluster.clusterProvince
    }));
    
    useEffect(() => {
      if (isOpen) {
        setLocalFormData({
          clusterName: newCluster.clusterName,
          clusterState: newCluster.clusterState,
          clusterProvince: newCluster.clusterProvince
        });
      }
    }, [isOpen, newCluster]);
    
    const handleLocalChange = (e) => {
      const { name, value } = e.target;
      setLocalFormData(prev => ({
        ...prev,
        [name]: value
      }));
    };
    
    const handleSubmit = () => {
      const clusterData = {
        clusterName: localFormData.clusterName,
        clusterState: localFormData.clusterState,
        clusterProvince: localFormData.clusterProvince
      };
      
      if (editMode) {
        updateClusterMutation.mutate({
          clusterID: newCluster.clusterID,
          clusterData
        });
      } else {
        addClusterMutation.mutate(clusterData);
      }
    };
    
    const isSubmitting = addClusterMutation.isPending || updateClusterMutation.isPending;
    
    return (
      <div className="modal-overlay">
        <div className="modal-container cluster-form-modal">
          <div className="modal-header">
            <h2>{editMode ? 'Edit Cluster' : 'Add New Cluster'}</h2>
            <button className="close-button" onClick={onClose}>×</button>
          </div>
          
          <div className="modal-body">
            <div className="form-group">
              <label htmlFor="clusterName">Cluster Name</label>
              <input
                type="text"
                id="clusterName"
                name="clusterName"
                value={localFormData.clusterName}
                onChange={handleLocalChange}
                placeholder="Enter cluster name"
                autoComplete="off"
                disabled={isSubmitting}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="clusterState">State</label>
              <input
                type="text"
                id="clusterState"
                name="clusterState"
                value={localFormData.clusterState}
                onChange={handleLocalChange}
                placeholder="Enter cluster state"
                required
                autoComplete="off"
                disabled={isSubmitting}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="clusterProvince">Province</label>
              <input
                type="text"
                id="clusterProvince"
                name="clusterProvince"
                value={localFormData.clusterProvince}
                onChange={handleLocalChange}
                placeholder="Enter province"
                required
                autoComplete="off"
                disabled={isSubmitting}
              />
            </div>
          </div>
          
          <div className="modal-footer">
            <div className="button-group">
              <button 
                className="submit-button"
                onClick={handleSubmit}
                disabled={!localFormData.clusterName || !localFormData.clusterState || !localFormData.clusterProvince || isSubmitting}
              >
                {isSubmitting ? (editMode ? 'Updating...' : 'Adding...') : (editMode ? 'Update Cluster' : 'Add Cluster')}
              </button>
              <button 
                className="cancel-button" 
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  });

  return (
    <div>
      {showToast && <Toast type={toastType} message={toastMessage} />}
      
      <div className="header-container">
        <h1 className="dashboard-page-title">Cluster Management</h1>
        <SearchBar
          value={searchKey}
          onChange={handleSearchChange}
          placeholder="Search clusters..."
        />
      </div>

      <Filter filters={filters} onApplyFilters={handleApplyFilters} />
      <button 
        className="create-cluster-button"
        onClick={() => {
          resetForm();
          setShowAddModal(true);
        }}
      >
        Add New Cluster
      </button>

      {clustersLoading && (
        <div className="loader-box">
          <Loader />
        </div>
      )}
      
      {clustersError && (
        <Alert type="error" message={`Error: ${clustersErrorMessage?.message || 'Failed to load clusters'}`} />
      )}

      {!clustersLoading && !clustersError && (
        <PaginatedTable
          data={filteredClusters}
          columns={columns}
          rowKey="clusterid"
          enableCheckbox={false}
        />
      )}

      <Modal
        isOpen={!!selectedCluster}
        title={selectedCluster?.clustername || 'Cluster Details'}
        data={selectedCluster || {}}
        labels={displayLabels}
        onClose={() => setSelectedCluster(null)}
      />
      
      <AddClusterModal 
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          resetForm();
        }} 
      />

      {isDialogOpen && (
        <Alert
          isOpen={isDialogOpen}
          title="Confirm Delete"
          message={`Are you sure you want to delete Cluster ${clusterToDelete?.clustername}?`}
          onConfirm={() => {
            if (clusterToDelete) {
              deleteClusterMutation.mutate(clusterToDelete.clusterid);
            }
          }}
          onCancel={() => {
            setIsDialogOpen(false);
            setClusterToDelete(null);
          }}
        />
      )}
    </div>
  );
};

export default Cluster;

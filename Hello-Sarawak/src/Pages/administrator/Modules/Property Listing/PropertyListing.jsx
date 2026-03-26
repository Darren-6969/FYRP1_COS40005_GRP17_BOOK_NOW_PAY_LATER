import React, { useState, useEffect } from 'react';
import { fetchPropertiesListingTable, updatePropertyStatus, deleteProperty, propertyListingAccept, propertyListingReject, fetchReservation } from '../../../../../Api/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ActionDropdown from '../../../../Component/ActionDropdown/ActionDropdown';
import Modal from '../../../../Component/Modal/Modal';
import PropertyForm from '../../../../Component/PropertyForm/PropertyForm';
import SearchBar from '../../../../Component/SearchBar/SearchBar';
import Filter from '../../../../Component/Filter/Filter';
import PaginatedTable from '../../../../Component/PaginatedTable/PaginatedTable';
import Toast from '../../../../Component/Toast/Toast';
import Alert from '../../../../Component/Alert/Alert';
import Loader from '../../../../Component/Loader/Loader';
import Status from '../../../../Component/Status/Status';
import { FaEye, FaEdit, FaTrash, FaCheck, FaTimes } from 'react-icons/fa';
import '../../../../Component/MainContent/MainContent.css';
import '../Property Listing/PropertyListing.css';


const PropertyListing = () => {
    const [searchKey, setSearchKey] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('All');
    const [appliedFilters, setAppliedFilters] = useState({ status: 'All' });
    const [selectedProperty, setSelectedProperty] = useState(null);
    const [editProperty, setEditProperty] = useState(null);
    const [isPropertyFormOpen, setIsPropertyFormOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [showToast, setShowToast] = useState(false);
    const [toastType, setToastType] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [propertyToDelete, setPropertyToDelete] = useState(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    
    const queryClient = useQueryClient();
    
    const { data, isLoading, error } = useQuery({
        queryKey: ['properties', page, pageSize], 
        
        queryFn: () => fetchPropertiesListingTable(page, pageSize), 
        placeholderData: (previousData) => previousData,
        
        select: (data) => ({
            properties: (data?.properties || []).filter(property => property.propertyid !== undefined),
            totalCount: data?.totalCount || 0
        }),
        staleTime: 30 * 60 * 1000,
    });
    
    // Extract properties from query result
    const properties = data?.properties || [];
    const totalCount = data?.totalCount || 0;

    const displayToast = (type, message) => {
        setToastType(type);
        setToastMessage(message);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 5000);
    };

// React Query mutation for accepting property (enabling)
    const acceptMutation = useMutation({
        mutationFn: async (propertyId) => {
            await propertyListingAccept(propertyId);
            return updatePropertyStatus(propertyId, 'Available');
        },
        onSuccess: (data, propertyId) => {
            // 1. INSTANT UI UPDATE: Force the table to show 'Available' immediately!
            queryClient.setQueryData(['properties', page, pageSize], (oldData) => {
                if (!oldData) return oldData;
                return {
                    ...oldData,
                    properties: oldData.properties.map(prop => 
                        prop.propertyid === propertyId 
                            ? { ...prop, propertystatus: 'Available' } 
                            : prop
                    )
                };
            });
            // 2. Still clear cache in background just to be safe
            queryClient.invalidateQueries({ queryKey: ['properties'] });
        },
        onError: (error) => {
            console.error('Failed to accept property', error);
        }
    });

    // React Query mutation for rejecting property (disabling)
    const rejectMutation = useMutation({
        mutationFn: async (propertyId) => {
            await propertyListingReject(propertyId);
            return updatePropertyStatus(propertyId, 'Unavailable');
        },
        onSuccess: (data, propertyId) => {
            // 1. INSTANT UI UPDATE: Force the table to show 'Unavailable' immediately!
            queryClient.setQueryData(['properties', page, pageSize], (oldData) => {
                if (!oldData) return oldData;
                return {
                    ...oldData,
                    properties: oldData.properties.map(prop => 
                        prop.propertyid === propertyId 
                            ? { ...prop, propertystatus: 'Unavailable' } 
                            : prop
                    )
                };
            });
            // 2. Still clear cache in background just to be safe
            queryClient.invalidateQueries({ queryKey: ['properties'] });
        },
        onError: (error) => {
            console.error('Failed to reject property', error);
        }
    });

 // React Query mutation for deleting property
    const deleteMutation = useMutation({
        mutationFn: async (propertyId) => {
            return deleteProperty(propertyId);
        },
        onSuccess: (data, propertyId) => {
            displayToast('success', 'Property deleted successfully');
            
            // 1. INSTANT UI UPDATE: Remove the deleted property from the screen immediately!
            queryClient.setQueryData(['properties', page, pageSize], (oldData) => {
                if (!oldData) return oldData;
                return {
                    ...oldData,
                    // Filter out the property we just deleted so the row vanishes
                    properties: oldData.properties.filter(prop => prop.propertyid !== propertyId),
                    // Drop the total count by 1 so pagination updates
                    totalCount: oldData.totalCount - 1 
                };
            });

            // 2. Still clear cache in background just to be safe
            queryClient.invalidateQueries({ queryKey: ['properties'] });
        },
        onError: (error) => {
            console.error('Failed to delete property', error);
        },
        onSettled: () => {
            setIsDialogOpen(false);
            setPropertyToDelete(null);
        }
    });

    const handleAction = async (action, property) => {
        try {
            if (action === 'view') {
                setSelectedProperty({
                    propertyid: property.propertyid || 'N/A',
                    propertyname: property.propertyaddress || 'N/A',
                    clustername: property.clustername || 'N/A',
                    categoryname: property.categoryname || 'N/A',
                    propertyprice: property.normalrate || 'N/A',
                    propertylocation: property.nearbylocation || 'N/A',
                    propertyguestpaxno: property.propertyguestpaxno || 'N/A',
                    propertystatus: property.propertystatus || 'N/A',
                    propertybedtype: property.propertybedtype || 'N/A',
                    propertydescription: property.propertydescription || 'N/A',
                    images: property.propertyimage || [],
                    username: property.username || 'N/A',
                });
            } else if (action === 'edit') {
                if (property.propertystatus === 'Available') {
                    displayToast('error', 'You need to disable the property first before editing.');
                    return;
                }
                setEditProperty({ ...property });
                setIsPropertyFormOpen(true);
            } else if (action === 'accept') {
                await acceptMutation.mutateAsync(property.propertyid);
                displayToast('success', 'Property Accepted Successfully');
            } else if (action === 'reject') {
                await rejectMutation.mutateAsync(property.propertyid);
                displayToast('success', 'Property Rejected Successfully');
            } else if (action === 'enable') {
                await acceptMutation.mutateAsync(property.propertyid);
                displayToast('success', 'Property Enabled Successfully');
            } else if (action === 'disable') {
                await rejectMutation.mutateAsync(property.propertyid);
                displayToast('success', 'Property Disabled Successfully');
            } else if (action === 'delete') {
                if (property.propertystatus === 'Unavailable' && property.username === username) {
                    setPropertyToDelete(property.propertyid);
                    setIsDialogOpen(true);
                } else {
                    displayToast('error', 'You do not have permission to delete this property.');
                }
            } 
        } catch (error) {
            console.error('Error handling action:', error);
            displayToast('error', 'An error occurred while processing your request.');
        }
    };
    
    const handleDeleteProperty = async () => {
        try {
            const property = properties.find((prop) => prop.propertyid === propertyToDelete);

            if (!property) {
                displayToast('error', 'Property not found. Please refresh the page and try again.');
                setIsDialogOpen(false);
                setPropertyToDelete(null);
                return;
            }

            if (property.propertystatus !== 'Unavailable') {
                displayToast('error', 'Only unavailable properties can be deleted.');
                setIsDialogOpen(false);
                setPropertyToDelete(null);
                return;
            }

            // Use React Query to fetch reservations
            const reservationsQuery = await queryClient.fetchQuery({
                queryKey: ['reservations', propertyToDelete],
                queryFn: fetchReservation
            });
            
            const hasReservation = reservationsQuery.some(reservation => reservation.propertyid === propertyToDelete);

            if (hasReservation) {
                displayToast('error', 'This property has an existing reservation and cannot be deleted.');
                setIsDialogOpen(false);
                setPropertyToDelete(null);
                return;
            }

            deleteMutation.mutate(propertyToDelete);
        } catch (error) {
            console.error('Failed to delete property:', error);
            displayToast('error', 'Failed to delete property. Please try again.');
            setIsDialogOpen(false);
            setPropertyToDelete(null);
        }
    };

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
                { value: 'Pending', label: 'Pending' },
                { value: 'Available', label: 'Available' },
                { value: 'Unavailable', label: 'Unavailable' },
            ],
        },
    ];

    const displayLabels = {
        propertyid: "PID",
        propertyname: "Property Name",
        clustername: "Cluster Name",
        categoryname: "Category Name",
        propertyprice: "Property Price",
        propertylocation: "Property Location",
        propertyguestpaxno: "Guest Capacity",
        propertystatus: "Property Status",
        propertybedtype: "Bed Type",
        propertydescription: "Description",
        images: "Images",
        username: "Operator Name"
    };

    const filteredProperties = properties.filter((property) => {

        const statusMatch =
            appliedFilters.status === 'All' ||
            (property.propertystatus ?? 'Pending').toLowerCase() === appliedFilters.status.toLowerCase();


        const searchInFields =
            `${property.propertyid} ${property.propertyaddress} ${property.clustername} ${property.normalrate} ${property.propertystatus}`
                .toLowerCase()
                .includes(searchKey.toLowerCase());

        return statusMatch && searchInFields;
    });

    const propertyDropdownItems = (property, username, usergroup) => {
    const isOwner = property.username === username; 
    const isModerator = usergroup === 'Moderator';
    const isAdmin = usergroup === 'Administrator';

    const { propertystatus } = property;

    if (isModerator) {
        // Logic for moderator
        if (propertystatus === 'Pending') {
            return [
                { label: 'View Details', icon: <FaEye />, action: 'view' },
            ];
        } else if (propertystatus === 'Available') {
            return [
                { label: 'View Details', icon: <FaEye />, action: 'view' },
                { label: 'Edit', icon: <FaEdit />, action: 'edit' },
            ];
        } else if (propertystatus === 'Unavailable') {
            return [
                { label: 'View Details', icon: <FaEye />, action: 'view' },
                { label: 'Edit', icon: <FaEdit />, action: 'edit' },
            ];
        }
    }

    if (isAdmin) {
        if (!isOwner) {
            // Admin managing moderator's property
            if (property.username !== username && property.username.includes('admin')) {
                
                return [{ label: 'View Details', icon: <FaEye />, action: 'view' }];
            }
            if (propertystatus === 'Pending') {
                return [
                    { label: 'View Details', icon: <FaEye />, action: 'view' },
                    { label: 'Accept', icon: <FaCheck />, action: 'accept' },
                    { label: 'Reject', icon: <FaTimes />, action: 'reject' },
                ];
            } else if (propertystatus === 'Available') {
                return [
                    { label: 'View Details', icon: <FaEye />, action: 'view' },
                    { label: 'Disable', icon: <FaTimes />, action: 'disable' },
                ];
            } else if (propertystatus === 'Unavailable') {
                return [
                    { label: 'View Details', icon: <FaEye />, action: 'view' },
                    { label: 'Enable', icon: <FaCheck />, action: 'enable' },
                ];
            }
        } else {
            // Admin managing their own property
            if (propertystatus === 'Available') {
                return [
                    { label: 'View Details', icon: <FaEye />, action: 'view' },
                    { label: 'Edit', icon: <FaEdit />, action: 'edit' },
                    { label: 'Disable', icon: <FaTimes />, action: 'disable' },
                ];
            } else if (propertystatus === 'Unavailable') {
                return [
                    { label: 'View Details', icon: <FaEye />, action: 'view' },
                    { label: 'Edit', icon: <FaEdit />, action: 'edit' },
                    { label: 'Enable', icon: <FaCheck />, action: 'enable' },
                    { label: 'Delete', icon: <FaTrash />, action: 'delete' },
                ];
            }
        }
    }

    return [{ label: 'View Details', icon: <FaEye />, action: 'view' }];
};

    
const username = localStorage.getItem('username');
const usergroup = localStorage.getItem('usergroup'); 

const columns = [
    { header: 'PID', accessor: 'propertyid' },
    {
        header: 'Image',
        accessor: 'propertyimage',
        render: (property) => (
            property.propertyimage && property.propertyimage.length > 0 ? (
                <img
                    src={`data:image/jpeg;base64,${property.propertyimage[0]}`}
                    alt={property.propertyname}
                    style={{ width: 80, height: 80 }}
                />
            ) : (
                <span>No Image</span>
            )
        ),
    },
    { header: 'Name', accessor: 'propertyaddress' },
    { header: 'Price', accessor: 'normalrate' },
    { header: 'Cluster', accessor: 'clustername' },
    {
        header: 'Status',
        accessor: 'propertystatus',
        render: (property) => (
            <Status value={property.propertystatus || 'Pending'} />
        ),
    },
    {
        header: 'Actions',
        accessor: 'actions',
        render: (property) => (
            <ActionDropdown
                items={propertyDropdownItems(property, username, usergroup)}
                onAction={(action) => handleAction(action, property)}
            />
        ),
    },
];

    // Handle page change
    const handlePageChange = (newPage) => {
        setPage(newPage);
    };

    // Handle page size change
    const handlePageSizeChange = (newPageSize) => {
        setPageSize(newPageSize);
        setPage(1); // Reset to first page when changing page size
    };

    return (
        <div>
            <div className="header-container">
                <h1 className="dashboard-page-title">Property Listings</h1>
                <SearchBar value={searchKey} onChange={(newValue) => setSearchKey(newValue)} placeholder="Search properties..." />
            </div>

            <Filter filters={filters} onApplyFilters={handleApplyFilters} />

            <button
                className="create-property-button"
                onClick={() => {
                    setEditProperty(null);
                    setIsPropertyFormOpen(true);
                }}
            >
                Create New Property
            </button>

            {isLoading ? (
            <div className="loader-box">
                <Loader />
            </div>
        ) : error ? (
            <div className="error-message">
                Error loading properties. Please try again.
            </div>
        ) : (
            <PaginatedTable
                data={filteredProperties}
                columns={columns}
                rowKey="propertyid"
                currentPage={page}
                pageSize={pageSize}
                totalCount={totalCount}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
            />
        )}

            <Modal
                isOpen={!!selectedProperty}
                title={'Property Details'}
                data={selectedProperty || {}}
                labels={displayLabels}
                onClose={() => setSelectedProperty(null)}
            />

            {isPropertyFormOpen && (
                <PropertyForm
                    initialData={editProperty}
                    onSubmit={() => {
                    setIsPropertyFormOpen(false);
                    queryClient.invalidateQueries({ queryKey: ['properties'] });
                    displayToast('success', editProperty? 'Property updated successfully' : 'Property created successfully');
                }}
                    onClose={() => setIsPropertyFormOpen(false)}
            />
        )}

            <Alert
                isOpen={isDialogOpen}
                title="Confirm Delete"
                message="Are you sure you want to delete this property?"
                onConfirm={handleDeleteProperty}
                onCancel={() => setIsDialogOpen(false)}
            />

            {showToast && <Toast type={toastType} message={toastMessage} />}
        </div>
    );
};

export default PropertyListing;

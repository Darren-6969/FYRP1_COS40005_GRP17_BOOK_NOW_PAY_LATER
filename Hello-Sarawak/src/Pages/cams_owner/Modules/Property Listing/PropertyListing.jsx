import React, { useState} from 'react';
import { fetchPropertiesListingTable} from '../../../../../Api/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ActionDropdown from '../../../../Component/ActionDropdown/ActionDropdown';
import Modal from '../../../../Component/Modal/Modal';
import SearchBar from '../../../../Component/SearchBar/SearchBar';
import Filter from '../../../../Component/Filter/Filter';
import PaginatedTable from '../../../../Component/PaginatedTable/PaginatedTable';
import Toast from '../../../../Component/Toast/Toast';
import Loader from '../../../../Component/Loader/Loader';
import Status from '../../../../Component/Status/Status';
import { FaEye} from 'react-icons/fa';
import '../../../../Component/MainContent/MainContent.css';



const PropertyListing = () => {
    const [searchKey, setSearchKey] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('All');
    const [appliedFilters, setAppliedFilters] = useState({ status: 'All' });
    const [selectedProperty, setSelectedProperty] = useState(null);
    const [toastMessage, setToastMessage] = useState('');
    const [showToast, setShowToast] = useState(false);
    const [toastType, setToastType] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    
    const queryClient = useQueryClient();
    
    // Use React Query to fetch properties
    const { data, isLoading, error } = useQuery({
        queryKey: ['properties'],
        queryFn: () => fetchPropertiesListingTable(),
        select: (data) => ({
            properties: (data?.properties || []).filter(property => property.propertyid !== undefined),
            totalCount: data?.totalCount || 0
        }),
        staleTime: 30 * 60 * 1000,
        refetchInterval: 1000,  
    });
    
    // Extract properties from query result
    const properties = data?.properties || [];


    const displayToast = (type, message) => {
        setToastType(type);
        setToastMessage(message);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 5000);
    };

   

    const handleAction = (action, property) => {
        if (action === 'view') {
            setSelectedProperty({
                propertyaddress: property.propertyaddress || 'N/A',
                normalrate: property.normalrate || 'N/A',
                nearbylocation: property.nearbylocation || 'N/A',
                propertyguestpaxno: property.propertyguestpaxno || 'N/A',
                propertystatus: property.propertystatus || 'N/A',
                propertybedtype: property.propertybedtype || 'N/A',
                propertydescription: property.propertydescription || 'N/A',
                images: property.propertyimage || [],
                username: property.username || 'N/A',
            });
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
                items={[{ label: 'View Details', icon: <FaEye />, action: 'view' }]}
                onAction={(action) => handleAction(action, property)}
            />
        )
    }
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
                totalCount={filteredProperties.length}
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


        

            {showToast && <Toast type={toastType} message={toastMessage} />}
        </div>
    );
};

export default PropertyListing;

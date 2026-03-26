import React, { useState, useEffect, useRef } from "react";
import { GiWashingMachine, GiClothesline, GiDesert  } from "react-icons/gi";
import { PiSecurityCamera } from "react-icons/pi";
import { SiLightning } from "react-icons/si";
import { TbPawFilled, TbPawOff } from "react-icons/tb";
import { MdLandscape, MdOutlineKingBed, MdFireplace, MdSmokingRooms, MdKeyboardArrowDown, MdKeyboardArrowUp} from "react-icons/md";
import { FaWifi, FaDesktop, FaDumbbell, FaWater, FaSkiing, FaChargingStation, FaParking, FaSwimmingPool, FaTv, FaUtensils, FaSnowflake, FaSmokingBan, FaFireExtinguisher, FaFirstAid, FaShower, FaCoffee, FaUmbrellaBeach, FaBath, FaWind, FaBicycle, FaBabyCarriage, FaKey, FaBell, FaTree, FaCity } from "react-icons/fa";
import { propertiesListing, updateProperty, propertyListingRequest, fetchClusters, fetchUserData } from "../../../Api/api";
import Toast from "../Toast/Toast";
import "./PropertyForm.css";
import { useQuery } from '@tanstack/react-query';

const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1080;

const resizeImage = (file, maxWidth, maxHeight) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            let width = img.width;
            let height = img.height;

            if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width = Math.floor(width * ratio);
                height = Math.floor(height * ratio);
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob(
                (blob) => {
                    const resizedFile = new File([blob], file.name, {
                        type: 'image/jpeg',
                        lastModified: Date.now(),
                    });
                    resolve(resizedFile);
                },
                'image/jpeg',
                0.9
            );
        };
        img.onerror = (error) => reject(error);

        const reader = new FileReader();
        reader.onload = (e) => (img.src = e.target.result);
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
};

const PropertyForm = ({ initialData, onSubmit, onClose }) => {
    
    const formatDate = (dateString) => {
        if (!dateString) return "";
        const date = new Date(dateString);
        return date.toISOString().split('T')[0];
    };

    const predefinedFacilities = [
        { name: "Wi-Fi", icon: <FaWifi />, category: "essentials" },
        { name: "Kitchen", icon: <FaUtensils />, category: "essentials" },
        { name: "Washer", icon: <GiWashingMachine />, category: "essentials" },
        { name: "Dryer", icon: <GiClothesline />, category: "essentials" },
        { name: "Air Conditioning", icon: <FaSnowflake />, category: "essentials" },
        { name: "Heating", icon: <FaWind />, category: "essentials" },
        { name: "Dedicated workspace", icon: <FaDesktop />, category: "essentials" },
        { name: "TV", icon: <FaTv />, category: "essentials" },
        { name: "Free Parking", icon: <FaParking />, category: "features" },
        { name: "Swimming Pool", icon: <FaSwimmingPool />, category: "features" },
        { name: "Bathtub", icon: <FaBath />, category: "features" },
        { name: "EV charger", icon: <FaChargingStation />, category: "features" },
        { name: "Baby Crib", icon: <FaBabyCarriage />, category: "features" },
        { name: "King bed", icon: <MdOutlineKingBed />, category: "features" },
        { name: "Gym", icon: <FaDumbbell />, category: "features" },
        { name: "Breakfast", icon: <FaCoffee />, category: "features" },
        { name: "Indoor fireplace", icon: <MdFireplace />, category: "features" },
        { name: "Smoking allowed", icon: <MdSmokingRooms />, category: "features" },
        { name: "No Smoking", icon: <FaSmokingBan />, category: "features" },
        { name: "City View", icon: <FaCity />, category: "location" },
        { name: "Garden", icon: <FaTree />, category: "location" },
        { name: "Bicycle Rental", icon: <FaBicycle />, category: "location" },
        { name: "Beachfront", icon: <FaUmbrellaBeach />, category: "location" },
        { name: "Waterfront", icon: <FaWater />, category: "location" },
        { name: "Countryside", icon: <MdLandscape />, category: "location" },
        { name: "Ski-in/ski-out", icon: <FaSkiing />, category: "location" },
        { name: "Desert", icon: <GiDesert />, category: "location" },
        { name: "Security Alarm", icon: <FaBell />, category: "safety" },
        { name: "Fire Extinguisher", icon: <FaFireExtinguisher />, category: "safety" },
        { name: "First Aid Kit", icon: <FaFirstAid />, category: "safety" },
        { name: "Security Camera", icon: <PiSecurityCamera />, category: "safety" },
        { name: "Instant booking", icon: <SiLightning />, category: "booking" },
        { name: "Self check-in", icon: <FaKey />, category: "booking" },
        { name: "Pets Allowed", icon: <TbPawFilled />, category: "booking" },
        { name: "No Pets", icon: <TbPawOff />, category: "booking" }
    ];

    const categories = [
        "Resort", 
        "Hotel", 
        "Homestay", 
        "Lodge", 
        "Inn", 
        "Guesthouse", 
        "Apartment", 
        "Hostel"
    ];

    const [formData, setFormData] = useState({
        username: "",
        propertyPrice: "1",
        propertyAddress: "",
        nearbyLocation: "",
        propertyBedType: "1",
        propertyGuestPaxNo: "1",
        propertyDescription: "",
        facilities: [],
        propertyImage: [],
        clusterName: "",
        categoryName: "",
        weekendRate: "1",
        specialEventRate: "1",
        specialEventStartDate: "",
        specialEventEndDate: "",
        earlyBirdDiscountRate: "1",
        lastMinuteDiscountRate: "1",
        roomSetup: "" 
    });

    // ENHANCEMENT: Added maxGuests and description to room inventory
    const [roomInventory, setRoomInventory] = useState([
        { 
            id: Date.now(), 
            name: '', 
            bedType: '', 
            maxGuests: 1,
            description: '',
            price: '', 
            images: [] 
        }
    ]);

    const [removedImages, setRemovedImages] = useState([]);
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState("");
    const [toastType, setToastType] = useState("");
    const [selectedFacilities, setSelectedFacilities] = useState([]);
    const [isSpecialEventEnabled, setIsSpecialEventEnabled] = useState(false);
    const fileInputRef = useRef(null);
    const locationInputRef = useRef(null);
    const [showMoreAmenities, setShowMoreAmenities] = useState(false);
    const userid = localStorage.getItem("userid");
    
    const { data: userData } = useQuery({
        queryKey: ['user', userid],
        queryFn: () => fetchUserData(userid),
        enabled: !!userid
    });
    
    const { data: clustersData = [] } = useQuery({
        queryKey: ['clusters'],
        queryFn: fetchClusters,
    });
    
    const clusters = Array.isArray(clustersData) ? clustersData.map(cluster => cluster.clustername || '') : [];

    useEffect(() => {
        if (initialData) {
            let facilitiesArray = [];
            if (initialData.facilities) {
                if (typeof initialData.facilities === 'string') {
                    facilitiesArray = initialData.facilities.trim() 
                        ? initialData.facilities.split(",").map(facility => facility.trim())
                        : [];
                } else if (Array.isArray(initialData.facilities)) {
                    facilitiesArray = initialData.facilities;
                }
            }

            let loadedDesc = initialData.propertydescription || "";
            let loadedSetup = initialData.roomsetup || initialData.roomSetup || initialData.propertybedtype || "";
            
            if (loadedDesc.includes("_ROOMDATA_")) {
                const parts = loadedDesc.split("_ROOMDATA_");
                loadedDesc = parts[0];
                loadedSetup = parts[1];
            }

            let parsedRooms = [{ id: Date.now(), name: '', bedType: '', maxGuests: 1, description: '', price: '', images: [] }];
            try {
                if (typeof loadedSetup === 'string' && loadedSetup.startsWith('[')) {
                    parsedRooms = JSON.parse(loadedSetup);
                    loadedSetup = "inventory_mode";
                } else if (['Hotel', 'Resort', 'Inn', 'Hostel'].includes(initialData.categoryname) && loadedSetup) {
                    const beds = loadedSetup.split(',').map(s => s.trim()).filter(Boolean);
                    parsedRooms = beds.map((bed, idx) => ({
                        id: Date.now() + idx,
                        name: `Standard Room (${bed})`,
                        bedType: bed,
                        maxGuests: initialData.propertyguestpaxno || 1,
                        description: "",
                        price: initialData.normalrate || "0",
                        images: []
                    }));
                    loadedSetup = "inventory_mode";
                }
            } catch(e) {}
            
            setFormData({
                username: initialData.username || "",
                propertyPrice: initialData.normalrate || "",
                propertyAddress: initialData.propertyaddress || "",
                nearbyLocation: initialData.nearbylocation || "",
                propertyBedType: initialData.propertybedtype || "",
                propertyGuestPaxNo: initialData.propertyguestpaxno || "",
                propertyDescription: loadedDesc,
                facilities: facilitiesArray,
                propertyImage: initialData.propertyimage || [],
                clusterName: initialData.clustername || "",
                categoryName: initialData.categoryname || "",
                weekendRate: initialData.weekendrate || "1",
                specialEventRate: initialData.specialeventrate || "1",
                specialEventStartDate: formatDate(initialData.startdate),
                specialEventEndDate: formatDate(initialData.enddate),
                earlyBirdDiscountRate: initialData.earlybirddiscountrate || "1",
                lastMinuteDiscountRate: initialData.lastminutediscountrate || "1",
                roomSetup: loadedSetup === "inventory_mode" ? "" : loadedSetup
            });

            if(loadedSetup === "inventory_mode") {
                setRoomInventory(parsedRooms);
            }
            
            setIsSpecialEventEnabled(!!(initialData.startdate && initialData.enddate));
            setSelectedFacilities(facilitiesArray);
        } else {
            setFormData(prev => ({
                ...prev,
                username: localStorage.getItem("username") || "",
            }));
        }
    }, [initialData]);

    useEffect(() => {
        if (userData && Array.isArray(clustersData) && clustersData.length > 0 && !initialData) {
            const userClusterId = userData.clusterid;
            if (userClusterId) {
                const userCluster = clustersData.find(
                    cluster => cluster.clusterid?.toString() === userClusterId.toString()
                );
                if (userCluster) {
                    setFormData(prev => ({
                        ...prev,
                        clusterName: userCluster.clustername
                    }));
                }
            }
        }
    }, [userData, clustersData, initialData]);

    useEffect(() => {
        if (initialData?.facilities) {
          const selected = initialData.facilities.split(',').map(f => f.trim());
          setSelectedFacilities(selected);
        }
    }, [initialData]);

    useEffect(() => {
        if (window.google && locationInputRef.current) {
            const autocomplete = new window.google.maps.places.Autocomplete(locationInputRef.current);
            autocomplete.addListener('place_changed', () => {
                const place = autocomplete.getPlace();
                if (place && place.formatted_address) {
                    setFormData((prev) => ({ ...prev, nearbyLocation: place.formatted_address }));
                }
            });
        }
    }, []);

    const addRoom = () => {
        setRoomInventory([
            ...roomInventory, 
            { id: Date.now(), name: '', bedType: '', maxGuests: 1, description: '', price: '', images: [] }
        ]);
    };
    
    const removeRoom = (id) => { 
        if(roomInventory.length > 1) {
            setRoomInventory(roomInventory.filter(room => room.id !== id)); 
        }
    };
    
    const updateRoom = (id, field, value) => {
        setRoomInventory(roomInventory.map(room => 
            room.id === id ? { ...room, [field]: value } : room
        ));
    };

    const handleRoomImageUpload = async (roomId, e) => {
        const files = Array.from(e.target.files).filter(file => file.type.startsWith('image/'));
        if (files.length === 0) return;

        try {
            const base64Images = await Promise.all(files.map(file => {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const img = new Image();
                        img.onload = () => {
                            const canvas = document.createElement('canvas');
                            const ctx = canvas.getContext('2d');
                            let width = img.width;
                            let height = img.height;
                            if (width > 800 || height > 600) {
                                const ratio = Math.min(800 / width, 600 / height);
                                width = Math.floor(width * ratio);
                                height = Math.floor(height * ratio);
                            }
                            canvas.width = width;
                            canvas.height = height;
                            ctx.drawImage(img, 0, 0, width, height);
                            resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]); 
                        };
                        img.src = event.target.result;
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
            }));
            
            setRoomInventory(prev => prev.map(room => {
                if (room.id === roomId) {
                    return { 
                        ...room, 
                        images: [...(room.images || []), ...base64Images] 
                    };
                }
                return room;
            }));
        } catch (error) {
            setToastMessage('Error processing room images');
            setToastType('error');
            setShowToast(true);
        }
    };

    const removeRoomImage = (roomId, imageIndex) => {
        setRoomInventory(prev => prev.map(room => {
            if (room.id === roomId) {
                const newImages = [...(room.images || [])];
                newImages.splice(imageIndex, 1);
                return { ...room, images: newImages };
            }
            return room;
        }));
    };

    const toggleFacility = (facilityName) => {
        setSelectedFacilities((prev) => {
            if (facilityName === "Smoking allowed") {
                return prev.includes("No Smoking")
                    ? prev.filter(name => name !== "No Smoking").concat(facilityName)
                    : prev.includes(facilityName)
                        ? prev.filter(name => name !== facilityName)
                        : [...prev, facilityName];
            } else if (facilityName === "No Smoking") {
                return prev.includes("Smoking allowed")
                    ? prev.filter(name => name !== "Smoking allowed").concat(facilityName)
                    : prev.includes(facilityName)
                        ? prev.filter(name => name !== facilityName)
                        : [...prev, facilityName];
            }
            
            if (facilityName === "Pets Allowed") {
                return prev.includes("No Pets")
                    ? prev.filter(name => name !== "No Pets").concat(facilityName)
                    : prev.includes(facilityName)
                        ? prev.filter(name => name !== facilityName)
                        : [...prev, facilityName];
            } else if (facilityName === "No Pets") {
                return prev.includes("Pets Allowed")
                    ? prev.filter(name => name !== "Pets Allowed").concat(facilityName)
                    : prev.includes(facilityName)
                        ? prev.filter(name => name !== facilityName)
                        : [...prev, facilityName];
            }
            
            return prev.includes(facilityName)
                ? prev.filter((name) => name !== facilityName)
                : [...prev, facilityName];
        });
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        
        if (name === 'specialEventStartDate' || name === 'specialEventEndDate') {
            setFormData(prev => ({
                ...prev,
                [name]: value
            }));
            return;
        }

        if (name === 'categoryName') {
            setFormData(prev => ({
                ...prev,
                categoryName: value,
                roomSetup: "" 
            }));
            return;
        }
        
        const numValue = parseFloat(value);
        
        if (name === 'weekendRate') {
            if (numValue < 1.0 || numValue > 2.0) {
                setToastMessage("Weekend rate multiplier must be between 1.0 and 2.0");
                setToastType("error");
                setShowToast(true);
                return;
            }
        }
        
        setFormData(prev => ({
            ...prev,
            [name]: numValue >= 0 ? numValue : value
        }));
    };

    const handleFileChange = async (e) => {
        const newFiles = Array.from(e.target.files);
        const imageFiles = newFiles.filter((file) => file.type.startsWith('image/'));

        if (imageFiles.length < newFiles.length) {
            setToastMessage('Only image files are allowed. Non-image files have been ignored.');
            setToastType('warning');
            setShowToast(true);
        }

        try {
            const resizedFiles = await Promise.all(
                imageFiles.map((file) => resizeImage(file, MAX_WIDTH, MAX_HEIGHT))
            );
            setFormData((prev) => ({
                ...prev,
                propertyImage: [...prev.propertyImage, ...resizedFiles],
            }));
        } catch (error) {
            console.error('Error resizing images:', error);
            setToastMessage('Error resizing images. Please try again.');
            setToastType('error');
            setShowToast(true);
        }
    };

    const handleRemoveImage = (index) => {
        setFormData((prev) => {
            const updatedImages = [...prev.propertyImage];
            const removedImage = updatedImages.splice(index, 1)[0];
            if (!(removedImage instanceof File)) {
                setRemovedImages((prevRemoved) => [...prevRemoved, removedImage]);
            }
            return { ...prev, propertyImage: updatedImages };
        });
    };

    const toggleSpecialEvent = () => {
        setIsSpecialEventEnabled(!isSpecialEventEnabled);
        if (!isSpecialEventEnabled) {
            setFormData(prev => ({
                ...prev,
                specialEventStartDate: "",
                specialEventEndDate: ""
            }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const hotelTypes = ['Hotel', 'Resort', 'Inn', 'Hostel'];
        const homestayTypes = ['Homestay', 'Lodge', 'Guesthouse', 'Apartment'];
        
        let finalRoomSetup = formData.roomSetup;
        let finalDesc = formData.propertyDescription;

        if (hotelTypes.includes(formData.categoryName)) {
            const isValid = roomInventory.every(r => r.name && r.bedType && r.price && r.maxGuests);
            if (!isValid) {
                setToastMessage('Please fill out all required room details in the Room Builder.');
                setToastType('error');
                setShowToast(true);
                return;
            }
            
            finalRoomSetup = JSON.stringify(roomInventory);
            finalDesc = formData.propertyDescription + "_ROOMDATA_" + finalRoomSetup;
            
            formData.propertyPrice = roomInventory[0].price; 
        } else if (homestayTypes.includes(formData.categoryName) && !formData.roomSetup) {
            setToastMessage('Please select the property setup.');
            setToastType('error');
            setShowToast(true);
            return;
        }
        
        if (formData.propertyImage.length < 4) {
            setToastMessage("Please upload at least 4 property images");
            setToastType("error");
            setShowToast(true);
            return;
        }

        const data = new FormData();
        
        data.append("username", formData.username);
        data.append("propertyPrice", formData.propertyPrice);
        data.append("propertyAddress", formData.propertyAddress);
        data.append("nearbyLocation", formData.nearbyLocation);
        data.append("propertyBedType", formData.propertyBedType);
        data.append("propertyGuestPaxNo", formData.propertyGuestPaxNo);
        data.append("propertyDescription", finalDesc);
        data.append("facilities", selectedFacilities.join(","));
        data.append("clusterName", formData.clusterName);
        data.append("categoryName", formData.categoryName);
        data.append("roomSetup", finalRoomSetup); 
        
        if (initialData) {
            data.append("creatorid", localStorage.getItem("userid"));
            data.append("creatorUsername", localStorage.getItem("username"));
        }

        data.append("weekendRate", formData.weekendRate || "1");
        data.append("specialEventRate", formData.specialEventRate || "1");
        data.append("isSpecialEventEnabled", isSpecialEventEnabled);
        
        if (isSpecialEventEnabled) {
            data.append("specialEventStartDate", formData.specialEventStartDate || "");
            data.append("specialEventEndDate", formData.specialEventEndDate || "");
        }
        
        data.append("earlyBirdDiscountRate", formData.earlyBirdDiscountRate || "1");
        data.append("lastMinuteDiscountRate", formData.lastMinuteDiscountRate || "1");

        if (!initialData) {
            data.append("propertyStatus", "Pending");
        }

        formData.propertyImage.forEach((file) => {
            if (file instanceof File) {
                data.append("propertyImage", file);
            }
        });
        
        data.append("removedImages", JSON.stringify(removedImages));

        try {
            let response;
            let propertyId;
            
            if (initialData) {
                propertyId = initialData.propertyid || initialData.propertyID;
                if (!propertyId) {
                    throw new Error('Property ID is required for update');
                }
                response = await updateProperty(data, propertyId);
            } else {
                const usergroup = localStorage.getItem("usergroup");

                if (usergroup === "Administrator") {
                    response = await propertiesListing(data);
                    propertyId = response.propertyid;
                } else if (usergroup === "Moderator") {
                    response = await propertiesListing(data);
                    propertyId = response.propertyid;
                    await propertyListingRequest(propertyId);
                }
            }
           
            if (response && response.message) {
                setToastMessage(response.message);
                setToastType("success");
                setShowToast(true);
                onSubmit();
            }
        } catch (error) {
            console.error("Error submitting form:", error);
            setToastMessage(error.message || "Error submitting form. Please try again.");
            setToastType("error");
            setShowToast(true);
        }
    };

    const handleReset = () => {
        setFormData({
            username: localStorage.getItem("username") || "",
            propertyPrice: "1",
            propertyAddress: "",
            nearbyLocation: "",
            propertyBedType: "1",
            propertyGuestPaxNo: "1",
            propertyDescription: "",
            facilities: [],
            propertyImage: [],
            clusterName: "",
            categoryName: "",
            weekendRate: "1",
            specialEventRate: "1",
            specialEventStartDate: "",
            specialEventEndDate: "",
            earlyBirdDiscountRate: "1",
            lastMinuteDiscountRate: "1",
            roomSetup: "" 
        });
        setRoomInventory([{ id: Date.now(), name: '', bedType: '', maxGuests: 1, description: '', price: '', images: [] }]);
        setRemovedImages([]);
        setSelectedFacilities([]);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const imageInfoText = 
        formData.propertyImage.length > 0 
            ? "The first image will be the main display image." 
            : "";

    const getImageLabel = (index) =>
        index === 0 ? "Main Image" : index <= 2 ? "Secondary Image" : "Additional Image";

    const getLabelStyle = (index) => ({
        backgroundColor: index === 0 ? '#4CAF50' : index <= 2 ? '#2196F3' : '#9E9E9E',
        color: 'white',
    });

    return (
        <div 
            className="property-form-overlay" 
            onClick={(e) => e.stopPropagation()}
        >
            <div className="property-form-content">
                <div className="property-form-header">
                    <h1>
                        {initialData ? "Edit Property" : "Create a New Property"}
                    </h1>
                    <div className="property-form-header-buttons">
                        <button 
                            onClick={onClose} 
                            className="property-form-close-button"
                        >
                            ×
                        </button>
                    </div>
                </div>
                <form 
                    onSubmit={handleSubmit} 
                    className="property-form-listing-form"
                >
                    <div className="property-form-section full-width">
                        <h3>Property Details</h3>
                        <div className="property-form-details-grid">
                            
                            <div className="property-form-group">
                                <label>Username:</label>
                                <input 
                                    type="text" 
                                    name="username" 
                                    value={formData.username} 
                                    readOnly 
                                    required 
                                />
                            </div>
                            
                            <div className="property-form-group">
                                <label>Name:</label>
                                <input
                                    type="text"
                                    name="propertyAddress"
                                    value={formData.propertyAddress}
                                    onChange={handleChange}
                                    placeholder="e.g. Property"
                                    required
                                />
                            </div>
                            
                            <div className="property-form-group">
                                <label>Cluster (City):</label>
                                <select 
                                    name="clusterName" 
                                    value={formData.clusterName} 
                                    onChange={handleChange} 
                                    required
                                >
                                    <option value="">Select Cluster</option>
                                    {clusters.map((clusterName, index) => (
                                        <option 
                                            key={index} 
                                            value={clusterName}
                                        >
                                            {clusterName}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            
                            <div className="property-form-group">
                                <label>Category:</label>
                                <select 
                                    name="categoryName" 
                                    value={formData.categoryName} 
                                    onChange={handleChange} 
                                    required
                                >
                                    <option value="">Select Category</option>
                                    {categories.map((category) => (
                                        <option 
                                            key={category} 
                                            value={category}
                                        >
                                            {category}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* ENHANCEMENT: Fully Flexible Room Builder */}
                            {['Hotel', 'Resort', 'Inn', 'Hostel'].includes(formData.categoryName) ? (
                                <div 
                                    className="property-form-group" 
                                    style={{ gridColumn: '1 / -1' }}
                                >
                                    <label>
                                        Build Room Types 
                                        <span style={{fontSize: '12px', color: '#666', fontWeight: 'normal'}}>
                                            (Create separate rooms for customers to choose from)
                                        </span>
                                    </label>
                                    <div className="room-builder-container">
                                        {roomInventory.map((room) => (
                                            <div 
                                                key={room.id} 
                                                className="room-builder-card"
                                            >
                                                <div className="room-builder-row">
                                                    <div>
                                                        <label style={{fontSize: '12px', color: '#666'}}>
                                                            Room Name
                                                        </label>
                                                        <input 
                                                            type="text" 
                                                            placeholder="e.g. Deluxe Sea View" 
                                                            value={room.name} 
                                                            onChange={(e) => updateRoom(room.id, 'name', e.target.value)} 
                                                            required
                                                        />
                                                    </div>
                                                    <div>
                                                        <label style={{fontSize: '12px', color: '#666'}}>
                                                            Bed Configuration
                                                        </label>
                                                        <input 
                                                            type="text" 
                                                            placeholder="e.g. 2 Queen Beds + 1 Sofa" 
                                                            value={room.bedType} 
                                                            onChange={(e) => updateRoom(room.id, 'bedType', e.target.value)} 
                                                            required
                                                        />
                                                    </div>
                                                    <div>
                                                        <label style={{fontSize: '12px', color: '#666'}}>
                                                            Max Guests
                                                        </label>
                                                        <input 
                                                            type="number" 
                                                            placeholder="e.g. 4" 
                                                            value={room.maxGuests} 
                                                            onChange={(e) => updateRoom(room.id, 'maxGuests', e.target.value)} 
                                                            min="1" 
                                                            required
                                                        />
                                                    </div>
                                                    <div>
                                                        <label style={{fontSize: '12px', color: '#666'}}>
                                                            Base Price (RM)
                                                        </label>
                                                        <input 
                                                            type="number" 
                                                            placeholder="0.00" 
                                                            value={room.price} 
                                                            onChange={(e) => updateRoom(room.id, 'price', e.target.value)} 
                                                            min="1" 
                                                            required
                                                        />
                                                    </div>
                                                </div>
                                                
                                                <div>
                                                    <label style={{fontSize: '12px', color: '#666'}}>
                                                        Specific Room Description
                                                    </label>
                                                    <textarea 
                                                        placeholder="Describe this specific room type..." 
                                                        value={room.description} 
                                                        onChange={(e) => updateRoom(room.id, 'description', e.target.value)}
                                                    />
                                                </div>

                                                <div className="room-image-uploader">
                                                    <label>
                                                        Room Pictures (Optional): Upload pictures just for this room
                                                    </label>
                                                    <input 
                                                        type="file" 
                                                        multiple 
                                                        accept="image/*" 
                                                        onChange={(e) => handleRoomImageUpload(room.id, e)} 
                                                    />
                                                    <div className="room-image-preview-container">
                                                        {(room.images || []).map((img, i) => (
                                                            <div 
                                                                key={i} 
                                                                className="room-image-preview-item"
                                                            >
                                                                <img 
                                                                    src={`data:image/jpeg;base64,${img}`} 
                                                                    alt="Room Preview" 
                                                                />
                                                                <button 
                                                                    type="button" 
                                                                    className="room-image-remove-btn" 
                                                                    onClick={() => removeRoomImage(room.id, i)}
                                                                >
                                                                    ×
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                                
                                                <button 
                                                    type="button" 
                                                    className="remove-room-btn" 
                                                    onClick={() => removeRoom(room.id)}
                                                >
                                                    Remove Room
                                                </button>
                                            </div>
                                        ))}
                                        <button 
                                            type="button" 
                                            className="add-room-btn" 
                                            onClick={addRoom}
                                        >
                                            + Add Another Room Type
                                        </button>
                                    </div>
                                </div>
                            ) : ['Homestay', 'Lodge', 'Guesthouse', 'Apartment'].includes(formData.categoryName) ? (
                                <div 
                                    className="property-form-group" 
                                    style={{ gridColumn: '1 / -1' }}
                                >
                                    <label>
                                        Property Setup * <span style={{fontSize: '12px', color: '#666', fontWeight: 'normal'}}>
                                            (How is this rented?)
                                        </span>
                                    </label>
                                    <select 
                                        name="roomSetup" 
                                        value={formData.roomSetup} 
                                        onChange={handleChange} 
                                        required 
                                        className="property-form-input" 
                                        style={{width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd'}}
                                    >
                                        <option value="">Select setup...</option>
                                        <option value="Whole House">Whole House</option>
                                        <option value="Whole Apartment">Whole Apartment</option>
                                        <option value="Private Room">Private Room</option>
                                        <option value="Shared Room">Shared Room</option>
                                    </select>
                                </div>
                            ) : null}

                            {!['Hotel', 'Resort', 'Inn', 'Hostel'].includes(formData.categoryName) && (
                                <div className="property-form-group">
                                    <label>Base Price (MYR):</label>
                                    <input
                                        type="number"
                                        name="propertyPrice"
                                        value={formData.propertyPrice}
                                        onChange={handleChange}
                                        min="1"
                                        required
                                    />
                                </div>
                            )}

                            <div className="property-form-group">
                                <label>Total Property Capacity (Pax):</label>
                                <input
                                    type="number"
                                    name="propertyGuestPaxNo"
                                    value={formData.propertyGuestPaxNo}
                                    onChange={handleChange}
                                    min="1"
                                    required
                                />
                            </div>
                            <div className="property-form-group">
                                <label>Total Property Beds:</label>
                                <input
                                    type="number"
                                    name="propertyBedType"
                                    value={formData.propertyBedType}
                                    onChange={handleChange}
                                    min="1"
                                    required
                                />
                            </div>
                            <div className="property-form-group">
                                <label>Location:</label>
                                <input
                                    type="text"
                                    name="nearbyLocation"
                                    value={formData.nearbyLocation}
                                    onChange={handleChange}
                                    placeholder="e.g. No.123, LOT 1234, Lorong 1, Jalan ABC, Kuching, Sarawak"
                                    required
                                    ref={locationInputRef}
                                />
                            </div>
                            <div className="property-form-group full-width">
                                <label>General Property Description:</label>
                                <textarea
                                    name="propertyDescription"
                                    value={formData.propertyDescription}
                                    onChange={handleChange}
                                    placeholder="e.g. This Property Has Good View"
                                    required
                                />
                            </div>
                        </div>
                    </div>
                    
                    <div className="property-form-section full-width">
                        <h3>Dynamic Pricing</h3>
                        <div className="property-form-pricing-grid">
                            
                            <div className="property-form-group">
                                <label>Weekend Rate Multiplier:</label>
                                <input
                                    type="number"
                                    name="weekendRate"
                                    value={formData.weekendRate}
                                    onChange={handleChange}
                                    min="1"
                                    max="2"
                                    step="0.1"
                                />
                            </div>
                            
                            <div className="property-form-group">
                                <div className="property-form-label-with-toggle">
                                    <label>Special Event Rate:</label>
                                    <div className="property-form-special-event-toggle">
                                        <label className="property-form-switch">
                                            <input 
                                                type="checkbox" 
                                                checked={isSpecialEventEnabled} 
                                                onChange={toggleSpecialEvent}
                                            />
                                            <span className="property-form-slider"></span>
                                        </label>
                                        <span className="property-form-toggle-label">
                                            {isSpecialEventEnabled ? "Enabled" : "Disabled"}
                                        </span>
                                    </div>
                                </div>
                                <input 
                                    type="number" 
                                    name="specialEventRate" 
                                    value={formData.specialEventRate} 
                                    onChange={handleChange} 
                                    min="1" 
                                    max="2" 
                                    step="0.01"
                                />
                            </div>

                            {isSpecialEventEnabled && (
                                <>
                                    <div className="property-form-group">
                                        <label>Event Start Date:</label>
                                        <input 
                                            type="date" 
                                            name="specialEventStartDate" 
                                            value={formData.specialEventStartDate} 
                                            onChange={handleChange} 
                                            min={new Date().toISOString().split('T')[0]} 
                                            required
                                        />
                                    </div>
                                    <div className="property-form-group">
                                        <label>Event End Date:</label>
                                        <input 
                                            type="date" 
                                            name="specialEventEndDate" 
                                            value={formData.specialEventEndDate} 
                                            onChange={handleChange} 
                                            min={formData.specialEventStartDate || new Date().toISOString().split('T')[0]} 
                                            required
                                        />
                                    </div>
                                </>
                            )}
                            
                            <div className="property-form-group">
                                <label>Early Bird Discount Rate:</label>
                                <input 
                                    type="number" 
                                    name="earlyBirdDiscountRate" 
                                    value={formData.earlyBirdDiscountRate} 
                                    onChange={handleChange} 
                                    min="0.1" 
                                    max="1" 
                                    step="0.01"
                                />
                            </div>
                            
                            <div className="property-form-group">
                                <label>Last Minute Discount Rate:</label>
                                <input 
                                    type="number" 
                                    name="lastMinuteDiscountRate" 
                                    value={formData.lastMinuteDiscountRate} 
                                    onChange={handleChange} 
                                    min="0.1" 
                                    max="1" 
                                    step="0.01"
                                />
                            </div>
                        </div>
                    </div>
                    
                    <div className="property-form-section full-width">
                        <h3>Facilities</h3>
                        <div className="property-form-filter-section">
                            
                            <div className="property-form-essentials-section">
                                <h5>Essentials</h5>
                                <div className="property-form-amenities-grid">
                                    {predefinedFacilities.filter(f => f.category === "essentials").map((facility) => (
                                        <div 
                                            key={facility.name} 
                                            className={`property-form-amenity-item ${selectedFacilities.includes(facility.name) ? 'selected' : ''}`} 
                                            onClick={() => toggleFacility(facility.name)}
                                        >
                                            <span className="property-form-amenity-icon">
                                                {facility.icon}
                                            </span>
                                            <span className="property-form-amenity-text">
                                                {facility.name}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {!showMoreAmenities && (
                                <button 
                                    type="button" 
                                    className="property-form-show-more-button" 
                                    onClick={() => setShowMoreAmenities(true)}
                                >
                                    Show more <MdKeyboardArrowDown />
                                </button>
                            )}

                            {showMoreAmenities && (
                                <>
                                    <div className="property-form-features-section">
                                        <h5>Features</h5>
                                        <div className="property-form-amenities-grid">
                                            {predefinedFacilities.filter(f => f.category === "features").map((facility) => (
                                                <div 
                                                    key={facility.name} 
                                                    className={`property-form-amenity-item ${selectedFacilities.includes(facility.name) ? 'selected' : ''}`} 
                                                    onClick={() => toggleFacility(facility.name)}
                                                >
                                                    <span className="property-form-amenity-icon">
                                                        {facility.icon}
                                                    </span>
                                                    <span className="property-form-amenity-text">
                                                        {facility.name}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    <div className="property-form-location-section">
                                        <h5>Location</h5>
                                        <div className="property-form-amenities-grid">
                                            {predefinedFacilities.filter(f => f.category === "location").map((facility) => (
                                                <div 
                                                    key={facility.name} 
                                                    className={`property-form-amenity-item ${selectedFacilities.includes(facility.name) ? 'selected' : ''}`} 
                                                    onClick={() => toggleFacility(facility.name)}
                                                >
                                                    <span className="property-form-amenity-icon">
                                                        {facility.icon}
                                                    </span>
                                                    <span className="property-form-amenity-text">
                                                        {facility.name}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    <div className="property-form-safety-section">
                                        <h5>Safety</h5>
                                        <div className="property-form-amenities-grid">
                                            {predefinedFacilities.filter(f => f.category === "safety").map((facility) => (
                                                <div 
                                                    key={facility.name} 
                                                    className={`property-form-amenity-item ${selectedFacilities.includes(facility.name) ? 'selected' : ''}`} 
                                                    onClick={() => toggleFacility(facility.name)}
                                                >
                                                    <span className="property-form-amenity-icon">
                                                        {facility.icon}
                                                    </span>
                                                    <span className="property-form-amenity-text">
                                                        {facility.name}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    <div className="property-form-booking-section">
                                        <h5>Booking Options</h5>
                                        <div className="property-form-amenities-grid">
                                            {predefinedFacilities.filter(f => f.category === "booking").map((facility) => (
                                                <div 
                                                    key={facility.name} 
                                                    className={`property-form-amenity-item ${selectedFacilities.includes(facility.name) ? 'selected' : ''}`} 
                                                    onClick={() => toggleFacility(facility.name)}
                                                >
                                                    <span className="property-form-amenity-icon">
                                                        {facility.icon}
                                                    </span>
                                                    <span className="property-form-amenity-text">
                                                        {facility.name}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    <button 
                                        type="button" 
                                        className="property-form-show-less-button" 
                                        onClick={() => setShowMoreAmenities(false)}
                                    >
                                        Show less <MdKeyboardArrowUp />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                    
                    <div className="property-form-section full-width">
                        <h3>Main Hotel/Property Images</h3>
                        <div className="property-form-group">
                            <label>Upload General Images:</label>
                            <input 
                                type="file" 
                                name="propertyImage" 
                                accept="image/*" 
                                onChange={handleFileChange} 
                                ref={fileInputRef} 
                                multiple 
                            />
                            {formData.propertyImage.length < 4 && (
                                <div className="property-form-validation-warning">
                                    Minimum 4 images required
                                </div>
                            )}
                        </div>
                        <div className="property-form-existing-images-container">
                            {formData.propertyImage.map((image, index) => (
                                <div key={index} className="property-form-image-item">
                                    <div 
                                        className="property-form-image-label" 
                                        style={getLabelStyle(index)}
                                    >
                                        {getImageLabel(index)}
                                    </div>
                                    
                                    {image instanceof File ? (
                                        <img src={URL.createObjectURL(image)} alt="Preview"/>
                                    ) : (
                                        <img src={`data:image/jpeg;base64,${image}`} alt="Preview"/>
                                    )}
                                    
                                    <button 
                                        type="button" 
                                        className="property-form-remove-image-btn" 
                                        onClick={() => handleRemoveImage(index)}
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    <div className="property-form-button-group">
                        <button 
                            type="button" 
                            onClick={handleReset} 
                            className="property-form-reset-button"
                        >
                            Reset
                        </button>
                        <button 
                            type="submit" 
                            className="property-form-submit-button"
                        >
                            {initialData ? "Update Property" : "Create Property"}
                        </button>
                    </div>
                </form>
                {showToast && (
                    <Toast 
                        type={toastType} 
                        message={toastMessage} 
                    />
                )}
            </div>
        </div>
    );
};

export default PropertyForm;
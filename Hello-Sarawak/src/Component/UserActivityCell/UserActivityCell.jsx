import React, { useState, useEffect } from 'react';
import { fetchGoogleUserData } from '../../../Api/api';
import './UserActivityCell.css';

const UserActivityCell = ({ user }) => {
    const [avatarSrc, setAvatarSrc] = useState(null);
    const [hasFallback, setHasFallback] = useState(false);
    const googleAccessToken = localStorage.getItem('googleAccessToken');
    
    // 尝试多种可能的路径格式
    const possiblePaths = [
        '/src/public/avatar.png', 
        '/public/avatar.png',
        '/avatar.png',
        '../../../src/public/avatar.png'
    ];
    
    // 内联base64默认头像，确保始终有图像可显示
    // 这是一个简单的灰色用户图标
    const inlineDefaultAvatar = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAABWklEQVR4nO2XTU7DMBCFP9QNYt9DsOYKcBTYFWkJBwJOADQSEnCJ5iiFF6g7JJBQJazKghkndhzSpBJI9JNGipQZz/Nsx/Y4cMZx0ANmwBuwB1RD2QObYDAl3OFVg+PUxEtg6Bk0BR6Ad2CRaL8GxhHRUadjaRDVn8qBruPAPTCK9FVAp6m3rQNKC+edsKHWfuQ9JXVgDLwknEgZHGC0dwUOGtwBs7YdeAHukxxI4R+5a5tCpb1vO3KgqwW0AyXwSXUOc75kB96Ai0iYUu+b+UvtnQfnZwZZcl6wAG4qRBmyF52GDMn1/bHXv4n45sAV1cGSgnk4qcVJsglT+DWYtk/vPrRrMM4SME3cGZLtP2RIugYlKMmb1qgLTGg28oDqv5GTQsaxm1T/ftvVbI1xYAfcBZ1ezcYURrXzbsiBXyF3JtyEDtT/aEMcNEMuQ/tVYNYPDuTgG9hpqO1Kgrj9AAAAAElFTkSuQmCC';

    // Map user status to CSS classes
    const statusMap = {
        'login': 'status-login',
        'logout': 'status-logout',
        'registered': 'status-registered',
    };

    // Validate Base64 string
    const isValidBase64 = (str) => {
        try {
            const base64Regex = /^[A-Za-z0-9+/=]+$/;
            return typeof str === 'string' && base64Regex.test(str) && atob(str);
        } catch (e) {
            console.warn('Invalid Base64 string:', str, e);
            return false;
        }
    };

    useEffect(() => {
        const fetchAvatar = async () => {
            try {
                setHasFallback(false);

                // Case 1: Use uimage if it starts with http (e.g., URL)
                if (user.uimage && user.uimage.length > 0 && user.uimage.startsWith('https')) {
                    console.log('Using uimage as URL:', user.uimage);
                    setAvatarSrc(user.uimage);
                    return;
                }

                // Case 2: Use Base64 image if valid
                if (user.uimage && user.uimage.length > 0 && isValidBase64(user.uimage)) {
                    const base64Src = `data:image/jpeg;base64,${user.uimage}`;
                    setAvatarSrc(base64Src);
                    return;
                }

                // Case 3: Fetch Google avatar if token exists
                if (googleAccessToken) {
                    console.log('Fetching Google avatar with token:', googleAccessToken);
                    const googleData = await fetchGoogleUserData(googleAccessToken);
                    if (googleData && googleData.picture && googleData.picture.startsWith('http')) {
                        console.log('Google avatar fetched:', googleData.picture);
                        setAvatarSrc(googleData.picture);
                        return;
                    } else {
                        console.warn('No valid picture in Google data:', googleData);
                    }
                }

                // Case 4: 直接使用内联默认头像
                setAvatarSrc(inlineDefaultAvatar);
            } catch (error) {
                console.error('Error fetching avatar for user', user.userid, error);
                setAvatarSrc(inlineDefaultAvatar);
            }
        };

        fetchAvatar();
    }, [user.uimage, googleAccessToken, user.userid]);

    const handleImageError = (e) => {
        console.error(`Failed to load avatar for user ${user.userid}:`, avatarSrc, e);
        
        // 图像加载失败时，使用内联默认头像
        e.target.src = inlineDefaultAvatar;
    };

    // Determine status class, default to offline for unknown statuses
    const statusClass = statusMap[user.ustatus?.toLowerCase()] || 'status-logout';

    return (
        <div className="user-container">
            <div className="avatar-container">
                <img
                    src={avatarSrc || inlineDefaultAvatar}
                    alt={user.username || 'Avatar'}
                    className="table-user-avatar"
                    onError={handleImageError}
                />
                <span className={`user-status-dot ${statusClass}`} />
            </div>
            <span className="table-user-username">{user.username || 'N/A'}</span>
        </div>
    );
};

export default UserActivityCell;
